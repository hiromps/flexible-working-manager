"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { calculateOvertime, type WorkTimeInput } from "@/lib/attendance/overtime";

const getSupabaseAdmin = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

const toJstYmd = (date: Date) => {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const requireEmployeeAccess = async (employeeId: number) => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("ログインが必要です。");
  }

  const supabase = getSupabaseAdmin();
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, user_id, weekly_legal_hours")
    .eq("id", employeeId)
    .single();

  if (error || !employee) {
    throw new Error("社員情報が見つかりません。");
  }

  if (employee.user_id !== userId) {
    throw new Error("この社員の勤怠を操作する権限がありません。");
  }

  return { supabase, employee };
};

const upsertOvertimeRows = async ({
  supabase,
  rows,
}: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  rows: ReturnType<typeof calculateOvertime>;
}) => {
  if (rows.length === 0) return;

  const { error } = await supabase.from("overtime_calculations").upsert(
    rows.map((row) => ({
      employee_id: row.employeeId,
      work_date: row.workDate,
      daily_ot_minutes: row.dailyOtMinutes,
      weekly_ot_minutes: row.weeklyOtMinutes,
      period_ot_minutes: row.periodOtMinutes,
      late_night_minutes: 0,
      holiday_minutes: 0,
      calc_version: 1,
    })),
    { onConflict: "employee_id,work_date,calc_version" },
  );

  if (error) {
    throw new Error(`残業計算の保存に失敗しました: ${error.message}`);
  }
};

const recalculateEmployeePeriod = async ({
  supabase,
  employeeId,
  workDate,
  weeklyLegalHours,
}: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  employeeId: number;
  workDate: string;
  weeklyLegalHours: number;
}) => {
  const { data: periods, error: periodError } = await supabase
    .from("monthly_periods")
    .select("id, start_date, end_date, legal_total_minutes")
    .lte("start_date", workDate)
    .gte("end_date", workDate)
    .order("start_date", { ascending: false })
    .limit(1);

  if (periodError) {
    throw new Error(`対象期間の取得に失敗しました: ${periodError.message}`);
  }

  const period = periods?.[0];
  if (!period) return;

  const [{ data: shifts, error: shiftsError }, { data: attendance, error: attendanceError }] =
    await Promise.all([
      supabase
        .from("shift_plans")
        .select("employee_id, work_date, planned_work_minutes")
        .eq("employee_id", employeeId)
        .eq("monthly_period_id", period.id),
      supabase
        .from("attendance_logs")
        .select("employee_id, work_date, actual_work_minutes")
        .eq("employee_id", employeeId)
        .gte("work_date", period.start_date)
        .lte("work_date", period.end_date),
    ]);

  if (shiftsError) {
    throw new Error(`シフト予定の取得に失敗しました: ${shiftsError.message}`);
  }

  if (attendanceError) {
    throw new Error(`勤怠実績の取得に失敗しました: ${attendanceError.message}`);
  }

  const attendanceRows = attendance ?? [];
  const rows: WorkTimeInput[] = (shifts ?? []).map((shift) => {
    const actual = attendanceRows.find(
      (row) => row.employee_id === employeeId && row.work_date === shift.work_date,
    );

    return {
      employeeId,
      workDate: shift.work_date,
      plannedWorkMinutes: shift.planned_work_minutes,
      actualWorkMinutes:
        actual && actual.actual_work_minutes > 0
          ? actual.actual_work_minutes
          : shift.planned_work_minutes,
    };
  });

  await upsertOvertimeRows({
    supabase,
    rows: calculateOvertime({
      rows,
      periodStart: period.start_date,
      legalTotalMinutes: period.legal_total_minutes,
      weeklyLegalMinutes: weeklyLegalHours * 60,
    }),
  });
};

export async function clockIn(employeeId: number) {
  const { supabase } = await requireEmployeeAccess(employeeId);
  const now = new Date();
  const workDate = toJstYmd(now);

  const { data: existingLog, error: findError } = await supabase
    .from("attendance_logs")
    .select("id, actual_start, actual_end")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (findError) {
    throw new Error(`本日の勤怠確認に失敗しました: ${findError.message}`);
  }

  if (existingLog?.actual_start) {
    throw new Error("本日はすでに出勤打刻済みです。");
  }

  const payload = {
    employee_id: employeeId,
    work_date: workDate,
    actual_start: now.toISOString(),
    actual_end: null,
    actual_break_minutes: 0,
    actual_work_minutes: 0,
    current_break_start: null,
    source_type: "web",
    updated_at: now.toISOString(),
  };

  const { error } = existingLog
    ? await supabase.from("attendance_logs").update(payload).eq("id", existingLog.id)
    : await supabase.from("attendance_logs").insert(payload);

  if (error) {
    throw new Error(`出勤打刻に失敗しました: ${error.message}`);
  }

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
}

export async function startBreak(employeeId: number, logId: number) {
  const { supabase } = await requireEmployeeAccess(employeeId);
  const now = new Date();

  const { data: log, error: findError } = await supabase
    .from("attendance_logs")
    .select("id, actual_start, actual_end, current_break_start")
    .eq("id", logId)
    .eq("employee_id", employeeId)
    .single();

  if (findError || !log) {
    throw new Error("本日の勤怠ログが見つかりません。");
  }

  if (!log.actual_start || log.actual_end) {
    throw new Error("勤務中のときだけ休憩を開始できます。");
  }

  if (log.current_break_start) {
    throw new Error("すでに休憩中です。");
  }

  const { error } = await supabase
    .from("attendance_logs")
    .update({
      current_break_start: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", logId)
    .eq("employee_id", employeeId);

  if (error) {
    throw new Error(`休憩開始の打刻に失敗しました: ${error.message}`);
  }

  revalidatePath("/attendance");
}

export async function endBreak(employeeId: number, logId: number) {
  const { supabase } = await requireEmployeeAccess(employeeId);
  const now = new Date();

  const { data: log, error: findError } = await supabase
    .from("attendance_logs")
    .select("id, current_break_start, actual_break_minutes")
    .eq("id", logId)
    .eq("employee_id", employeeId)
    .single();

  if (findError || !log?.current_break_start) {
    throw new Error("終了する休憩が見つかりません。");
  }

  const breakStartTime = new Date(log.current_break_start);
  const addMinutes = Math.max(0, Math.floor((now.getTime() - breakStartTime.getTime()) / 60_000));
  const newBreakMinutes = (log.actual_break_minutes ?? 0) + addMinutes;

  const { error } = await supabase
    .from("attendance_logs")
    .update({
      actual_break_minutes: newBreakMinutes,
      current_break_start: null,
      updated_at: now.toISOString(),
    })
    .eq("id", logId)
    .eq("employee_id", employeeId);

  if (error) {
    throw new Error(`休憩終了の打刻に失敗しました: ${error.message}`);
  }

  revalidatePath("/attendance");
}

export async function clockOut(employeeId: number, logId: number) {
  const { supabase, employee } = await requireEmployeeAccess(employeeId);
  const now = new Date();

  const { data: log, error: findError } = await supabase
    .from("attendance_logs")
    .select("id, work_date, actual_start, actual_end, actual_break_minutes, current_break_start")
    .eq("id", logId)
    .eq("employee_id", employeeId)
    .single();

  if (findError || !log) {
    throw new Error("本日の勤怠ログが見つかりません。");
  }

  if (!log.actual_start) {
    throw new Error("出勤打刻がないため退勤できません。");
  }

  if (log.actual_end) {
    throw new Error("本日はすでに退勤打刻済みです。");
  }

  let finalBreakMinutes = log.actual_break_minutes ?? 0;

  if (log.current_break_start) {
    const breakStartTime = new Date(log.current_break_start);
    finalBreakMinutes += Math.max(0, Math.floor((now.getTime() - breakStartTime.getTime()) / 60_000));
  }

  const startTime = new Date(log.actual_start);
  const totalMinutes = Math.max(0, Math.floor((now.getTime() - startTime.getTime()) / 60_000));
  const actualWorkMinutes = Math.max(0, totalMinutes - finalBreakMinutes);

  const { error } = await supabase
    .from("attendance_logs")
    .update({
      actual_end: now.toISOString(),
      actual_break_minutes: finalBreakMinutes,
      current_break_start: null,
      actual_work_minutes: actualWorkMinutes,
      updated_at: now.toISOString(),
    })
    .eq("id", logId)
    .eq("employee_id", employeeId);

  if (error) {
    throw new Error(`退勤打刻に失敗しました: ${error.message}`);
  }

  await recalculateEmployeePeriod({
    supabase,
    employeeId,
    workDate: log.work_date,
    weeklyLegalHours: employee.weekly_legal_hours,
  });

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
}

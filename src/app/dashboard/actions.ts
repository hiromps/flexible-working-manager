"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  calculateLegalTotalMinutes,
  calculateOvertime,
  type WorkTimeInput,
} from "@/lib/attendance/overtime";
import { parseAttendanceWorkbook, toJstTimestamp } from "@/lib/attendance/workbook";

export type DashboardActionState = {
  status: "idle" | "success" | "error";
  message: string;
  details?: string[];
};

type PeriodRow = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  base_date: string;
  legal_total_minutes: number;
  status: string;
};

type EmployeeRow = {
  id: number;
  weekly_legal_hours: number;
};

type ShiftRow = {
  employee_id: number;
  work_date: string;
  planned_work_minutes: number;
};

type AttendanceRow = {
  employee_id: number;
  work_date: string;
  actual_work_minutes: number;
};

type EmbeddedShiftRow = {
  workDate: string;
  dayType: string;
  plannedStart: string;
  plannedEnd: string;
  plannedBreakMinutes: number;
};

const getSupabaseAdmin = () =>
  createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "処理中に不明なエラーが発生しました。";

const parseTimeToMinutes = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/u);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 47 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const diffClockMinutes = (start: number | null, end: number | null) => {
  if (start === null || end === null) return 0;
  const normalizedEnd = end <= start ? end + 24 * 60 : end;
  return Math.max(0, normalizedEnd - start);
};

const dateToYmd = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;

const normalizeClosingRule = (value: string) =>
  value === "20日締" || value === "20譌･邱" ? "20日締" : "末日締";

const isWorkDayType = (value: string) => value === "出勤" || value === "蜃ｺ蜍､";

const requireAdmin = async () => {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("ログインが必要です。");
  }

  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    throw new Error("管理者権限が必要です。");
  }

  return { supabase, userId };
};

const getLatestPeriod = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
  const { data: periods, error } = await supabase
    .from("monthly_periods")
    .select("id, label, start_date, end_date, base_date, legal_total_minutes, status")
    .order("start_date", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`対象期間の取得に失敗しました: ${error.message}`);
  }

  return (periods?.[0] ?? null) as PeriodRow | null;
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

export async function importAttendanceWorkbook(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const { supabase } = await requireAdmin();
    const file = formData.get("attendanceWorkbook");

    if (!(file instanceof File) || file.size === 0) {
      return {
        status: "error",
        message: "出勤簿.xlsx を選択してください。",
      };
    }

    const preferredSheetName = formData.get("sheetName");
    const weeklyLegalHoursValue = Number(formData.get("weeklyLegalHours") ?? 40);
    const weeklyLegalHours = weeklyLegalHoursValue === 44 ? 44 : 40;
    const parsed = parseAttendanceWorkbook(
      await file.arrayBuffer(),
      typeof preferredSheetName === "string" ? preferredSheetName : null,
    );
    const legalTotalMinutes = calculateLegalTotalMinutes(
      weeklyLegalHours,
      parsed.period.calendarDays,
    );

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .upsert(
        {
          employee_code: parsed.employeeCode,
          full_name: parsed.fullName,
          department: parsed.department,
          weekly_legal_hours: weeklyLegalHours,
          is_variable_monthly: true,
        },
        { onConflict: "employee_code" },
      )
      .select("id, weekly_legal_hours")
      .single();

    if (employeeError || !employee) {
      throw new Error(`社員の保存に失敗しました: ${employeeError?.message ?? "unknown"}`);
    }

    const { data: existingPeriods, error: periodFindError } = await supabase
      .from("monthly_periods")
      .select("id")
      .eq("start_date", parsed.period.startDate)
      .eq("end_date", parsed.period.endDate)
      .limit(1);

    if (periodFindError) {
      throw new Error(`対象期間の確認に失敗しました: ${periodFindError.message}`);
    }

    const periodPayload = {
      label: parsed.period.label,
      start_date: parsed.period.startDate,
      end_date: parsed.period.endDate,
      base_date: parsed.period.baseDate,
      legal_total_minutes: legalTotalMinutes,
      status: "draft",
    };
    const existingPeriodId = existingPeriods?.[0]?.id as number | undefined;
    const { data: period, error: periodError } = existingPeriodId
      ? await supabase
          .from("monthly_periods")
          .update(periodPayload)
          .eq("id", existingPeriodId)
          .select("id")
          .single()
      : await supabase.from("monthly_periods").insert(periodPayload).select("id").single();

    if (periodError || !period) {
      throw new Error(`対象期間の保存に失敗しました: ${periodError?.message ?? "unknown"}`);
    }

    const shiftPayload = parsed.days
      .filter((day) => day.plannedWorkMinutes > 0)
      .map((day) => ({
        employee_id: employee.id,
        monthly_period_id: period.id,
        work_date: day.workDate,
        planned_start: toJstTimestamp(day.workDate, day.plannedStartMinutes),
        planned_end: toJstTimestamp(day.workDate, day.plannedEndMinutes),
        planned_break_minutes: day.plannedBreakMinutes,
        planned_work_minutes: day.plannedWorkMinutes,
        status: "draft",
      }));

    if (shiftPayload.length > 0) {
      const { error } = await supabase
        .from("shift_plans")
        .upsert(shiftPayload, { onConflict: "employee_id,work_date" });

      if (error) {
        throw new Error(`シフト予定の保存に失敗しました: ${error.message}`);
      }
    }

    const attendancePayload = parsed.days
      .filter((day) => day.actualStartMinutes !== null || day.actualEndMinutes !== null)
      .map((day) => ({
        employee_id: employee.id,
        work_date: day.workDate,
        actual_start: toJstTimestamp(day.workDate, day.actualStartMinutes),
        actual_end: toJstTimestamp(day.workDate, day.actualEndMinutes),
        actual_break_minutes: day.actualBreakMinutes,
        actual_work_minutes: day.actualWorkMinutes,
        source_type: "import",
      }));

    if (attendancePayload.length > 0) {
      const { error } = await supabase
        .from("attendance_logs")
        .upsert(attendancePayload, { onConflict: "employee_id,work_date" });

      if (error) {
        throw new Error(`勤怠実績の保存に失敗しました: ${error.message}`);
      }
    }

    const calculationRows: WorkTimeInput[] = parsed.days
      .filter((day) => day.plannedWorkMinutes > 0 || day.actualWorkMinutes > 0)
      .map((day) => ({
        employeeId: employee.id,
        workDate: day.workDate,
        plannedWorkMinutes: day.plannedWorkMinutes,
        actualWorkMinutes: day.actualWorkMinutes > 0 ? day.actualWorkMinutes : day.plannedWorkMinutes,
      }));

    await upsertOvertimeRows({
      supabase,
      rows: calculateOvertime({
        rows: calculationRows,
        periodStart: parsed.period.startDate,
        legalTotalMinutes,
        weeklyLegalMinutes: weeklyLegalHours * 60,
      }),
    });

    await supabase.from("audit_logs").insert({
      action_type: "attendance_workbook_imported",
      target_table: "monthly_periods",
      target_id: String(period.id),
      reason: `${file.name} / ${parsed.sheetName}`,
      after_json: {
        employeeCode: parsed.employeeCode,
        employeeName: parsed.fullName,
        importedShiftRows: shiftPayload.length,
        importedAttendanceRows: attendancePayload.length,
      },
    });

    revalidatePath("/dashboard");

    return {
      status: "success",
      message: `${parsed.fullName}さんの出勤簿を取り込み、シフト${shiftPayload.length}件・実績${attendancePayload.length}件を保存しました。`,
      details: parsed.importNotes,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}

export async function saveEmbeddedShiftWorkbook(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const { supabase } = await requireAdmin();
    const employeeIdValue = Number(formData.get("employeeId"));
    const employeeCode = String(formData.get("employeeCode") ?? "").trim();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const department = String(formData.get("department") ?? "").trim();
    const year = Number(formData.get("year"));
    const month = Number(formData.get("month"));
    const closingRule = normalizeClosingRule(String(formData.get("closingRule") ?? "末日締"));
    const weeklyLegalHoursValue = Number(formData.get("weeklyLegalHours") ?? 40);
    const weeklyLegalHours = weeklyLegalHoursValue === 44 ? 44 : 40;
    const rowsJson = String(formData.get("rowsJson") ?? "[]");

    if (!year || !month || month < 1 || month > 12) {
      return { status: "error", message: "対象年月を確認してください。" };
    }

    if (!fullName && !employeeIdValue) {
      return { status: "error", message: "社員名を入力するか、既存社員を選択してください。" };
    }

    const parsedRows = JSON.parse(rowsJson) as EmbeddedShiftRow[];
    if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
      return { status: "error", message: "シフト表の行がありません。" };
    }

    const startDate =
      closingRule === "20日締"
        ? new Date(Date.UTC(year, month - 2, 21))
        : new Date(Date.UTC(year, month - 1, 1));
    const endDate =
      closingRule === "20日締"
        ? new Date(Date.UTC(year, month - 1, 20))
        : new Date(Date.UTC(year, month, 0));
    const startDateText = dateToYmd(startDate);
    const endDateText = dateToYmd(endDate);
    const calendarDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    const legalTotalMinutes = calculateLegalTotalMinutes(weeklyLegalHours, calendarDays);

    let employee: EmployeeRow | null = null;

    if (employeeIdValue > 0) {
      const { data, error } = await supabase
        .from("employees")
        .update({
          employee_code: employeeCode || `EMP-${employeeIdValue}`,
          full_name: fullName || "未設定",
          department: department || null,
          weekly_legal_hours: weeklyLegalHours,
          is_variable_monthly: true,
        })
        .eq("id", employeeIdValue)
        .select("id, weekly_legal_hours")
        .single();

      if (error || !data) {
        throw new Error(`社員の更新に失敗しました: ${error?.message ?? "unknown"}`);
      }
      employee = data;
    } else {
      const fallbackCode = employeeCode || `EMP-${Date.now().toString().slice(-8)}`;
      const { data, error } = await supabase
        .from("employees")
        .upsert(
          {
            employee_code: fallbackCode,
            full_name: fullName,
            department: department || null,
            weekly_legal_hours: weeklyLegalHours,
            is_variable_monthly: true,
          },
          { onConflict: "employee_code" },
        )
        .select("id, weekly_legal_hours")
        .single();

      if (error || !data) {
        throw new Error(`社員の保存に失敗しました: ${error?.message ?? "unknown"}`);
      }
      employee = data;
    }

    const savedEmployee = employee;

    const { data: existingPeriods, error: periodFindError } = await supabase
      .from("monthly_periods")
      .select("id")
      .eq("start_date", startDateText)
      .eq("end_date", endDateText)
      .limit(1);

    if (periodFindError) {
      throw new Error(`対象期間の確認に失敗しました: ${periodFindError.message}`);
    }

    const periodPayload = {
      label: `${year}年${month}月度${closingRule}`,
      start_date: startDateText,
      end_date: endDateText,
      base_date: startDateText,
      legal_total_minutes: legalTotalMinutes,
      status: "draft",
    };
    const existingPeriodId = existingPeriods?.[0]?.id as number | undefined;
    const { data: period, error: periodError } = existingPeriodId
      ? await supabase
          .from("monthly_periods")
          .update(periodPayload)
          .eq("id", existingPeriodId)
          .select("id")
          .single()
      : await supabase.from("monthly_periods").insert(periodPayload).select("id").single();

    if (periodError || !period) {
      throw new Error(`対象期間の保存に失敗しました: ${periodError?.message ?? "unknown"}`);
    }

    const shiftPayload = parsedRows
      .map((row) => {
        const plannedStartMinutes = parseTimeToMinutes(row.plannedStart);
        const plannedEndMinutes = parseTimeToMinutes(row.plannedEnd);
        const plannedBreakMinutes = Math.max(0, Number(row.plannedBreakMinutes) || 0);
        const plannedWorkMinutes = Math.max(
          0,
          diffClockMinutes(plannedStartMinutes, plannedEndMinutes) - plannedBreakMinutes,
        );

        return {
          row,
          plannedStartMinutes,
          plannedEndMinutes,
          plannedBreakMinutes,
          plannedWorkMinutes,
        };
      })
      .filter(({ row, plannedWorkMinutes }) => isWorkDayType(row.dayType) && plannedWorkMinutes > 0)
      .map(({ row, plannedStartMinutes, plannedEndMinutes, plannedBreakMinutes, plannedWorkMinutes }) => ({
        employee_id: savedEmployee.id,
        monthly_period_id: period.id,
        work_date: row.workDate,
        planned_start: toJstTimestamp(row.workDate, plannedStartMinutes),
        planned_end: toJstTimestamp(row.workDate, plannedEndMinutes),
        planned_break_minutes: plannedBreakMinutes,
        planned_work_minutes: plannedWorkMinutes,
        status: "draft",
      }));

    if (shiftPayload.length === 0) {
      return { status: "error", message: "出勤日のシフトがありません。" };
    }

    const { error: deleteShiftError } = await supabase
      .from("shift_plans")
      .delete()
      .eq("employee_id", savedEmployee.id)
      .eq("monthly_period_id", period.id);

    if (deleteShiftError) {
      throw new Error(`既存シフトの置き換えに失敗しました: ${deleteShiftError.message}`);
    }

    const { error: shiftError } = await supabase
      .from("shift_plans")
      .upsert(shiftPayload, { onConflict: "employee_id,work_date" });

    if (shiftError) {
      throw new Error(`シフト保存に失敗しました: ${shiftError.message}`);
    }

    const calculationRows: WorkTimeInput[] = shiftPayload.map((shift) => ({
      employeeId: savedEmployee.id,
      workDate: shift.work_date,
      plannedWorkMinutes: shift.planned_work_minutes,
      actualWorkMinutes: shift.planned_work_minutes,
    }));

    await upsertOvertimeRows({
      supabase,
      rows: calculateOvertime({
        rows: calculationRows,
        periodStart: startDateText,
        legalTotalMinutes,
        weeklyLegalMinutes: weeklyLegalHours * 60,
      }),
    });

    const plannedMinutes = shiftPayload.reduce((total, row) => total + row.planned_work_minutes, 0);
    const overMinutes = Math.max(0, plannedMinutes - legalTotalMinutes);

    await supabase.from("audit_logs").insert({
      action_type: "embedded_shift_workbook_saved",
      target_table: "monthly_periods",
      target_id: String(period.id),
      reason: "Excel形式シフト表からAI自動作成",
      after_json: {
        employeeId: savedEmployee.id,
        shiftRows: shiftPayload.length,
        plannedMinutes,
        legalTotalMinutes,
        overMinutes,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/attendance");

    return {
      status: "success",
      message: `${shiftPayload.length}日のシフト表を作成しました。総予定 ${Math.round(
        (plannedMinutes / 60) * 10,
      ) / 10}時間 / 法定総枠 ${Math.round((legalTotalMinutes / 60) * 10) / 10}時間。`,
      details:
        overMinutes > 0
          ? [
              `法定総枠を${Math.round((overMinutes / 60) * 10) / 10}時間超過しています。休日数または勤務時間を調整してください。`,
            ]
          : ["法定総枠内に収まっています。"],
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}

export async function recalculateLatestPeriod(): Promise<void> {
  const { supabase } = await requireAdmin();
  const period = await getLatestPeriod(supabase);

  if (!period) {
    throw new Error("対象期間が未設定です。");
  }

  const [{ data: employees }, { data: shifts }, { data: attendanceLogs }] = await Promise.all([
    supabase.from("employees").select("id, weekly_legal_hours"),
    supabase
      .from("shift_plans")
      .select("employee_id, work_date, planned_work_minutes")
      .eq("monthly_period_id", period.id),
    supabase
      .from("attendance_logs")
      .select("employee_id, work_date, actual_work_minutes")
      .gte("work_date", period.start_date)
      .lte("work_date", period.end_date),
  ]);

  const employeeRows = (employees ?? []) as EmployeeRow[];
  const shiftRows = (shifts ?? []) as ShiftRow[];
  const attendanceRows = (attendanceLogs ?? []) as AttendanceRow[];

  for (const employee of employeeRows) {
    const employeeShifts = shiftRows.filter((row) => row.employee_id === employee.id);
    const rows = employeeShifts.map((shift) => {
      const attendance = attendanceRows.find(
        (row) => row.employee_id === employee.id && row.work_date === shift.work_date,
      );

      return {
        employeeId: employee.id,
        workDate: shift.work_date,
        plannedWorkMinutes: shift.planned_work_minutes,
        actualWorkMinutes:
          attendance && attendance.actual_work_minutes > 0
            ? attendance.actual_work_minutes
            : shift.planned_work_minutes,
      };
    });

    await upsertOvertimeRows({
      supabase,
      rows: calculateOvertime({
        rows,
        periodStart: period.start_date,
        legalTotalMinutes: period.legal_total_minutes,
        weeklyLegalMinutes: employee.weekly_legal_hours * 60,
      }),
    });
  }

  revalidatePath("/dashboard");
}

export async function confirmLatestPeriodShifts(): Promise<void> {
  const { supabase, userId } = await requireAdmin();
  const period = await getLatestPeriod(supabase);

  if (!period) {
    throw new Error("対象期間が未設定です。");
  }

  const { error: shiftError } = await supabase
    .from("shift_plans")
    .update({ status: "confirmed" })
    .eq("monthly_period_id", period.id);

  if (shiftError) {
    throw new Error(`シフト確定に失敗しました: ${shiftError.message}`);
  }

  const { error: periodError } = await supabase
    .from("monthly_periods")
    .update({ status: "confirmed" })
    .eq("id", period.id);

  if (periodError) {
    throw new Error(`対象期間の確定に失敗しました: ${periodError.message}`);
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: userId,
    action_type: "monthly_period_shifts_confirmed",
    target_table: "monthly_periods",
    target_id: String(period.id),
    reason: "管理者ダッシュボードから一括確定",
    before_json: { status: period.status },
    after_json: { status: "confirmed" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/attendance");
}

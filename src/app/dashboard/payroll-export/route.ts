import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

type Period = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
};

type Employee = {
  id: number;
  employee_code: string;
  full_name: string;
  department: string | null;
};

type ShiftPlan = {
  employee_id: number;
  planned_work_minutes: number;
  status: string;
};

type AttendanceLog = {
  employee_id: number;
  actual_work_minutes: number;
  actual_break_minutes: number;
};

type OvertimeCalculation = {
  employee_id: number;
  daily_ot_minutes: number;
  weekly_ot_minutes: number;
  period_ot_minutes: number;
  late_night_minutes: number;
  holiday_minutes: number;
};

export const dynamic = "force-dynamic";

const csvCell = (value: string | number | null | undefined) => {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
};

const hours = (minutes: number) => (Math.round((minutes / 60) * 100) / 100).toFixed(2);

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { data: periods } = await supabaseAdmin
    .from("monthly_periods")
    .select("id, label, start_date, end_date")
    .order("start_date", { ascending: false })
    .limit(1);

  const period = (periods?.[0] ?? null) as Period | null;

  if (!period) {
    return new Response("No monthly period", { status: 404 });
  }

  const [{ data: employees }, { data: shifts }, { data: attendanceLogs }, { data: overtimeRows }] =
    await Promise.all([
      supabaseAdmin
        .from("employees")
        .select("id, employee_code, full_name, department")
        .order("employee_code", { ascending: true }),
      supabaseAdmin
        .from("shift_plans")
        .select("employee_id, planned_work_minutes, status")
        .eq("monthly_period_id", period.id),
      supabaseAdmin
        .from("attendance_logs")
        .select("employee_id, actual_work_minutes, actual_break_minutes")
        .gte("work_date", period.start_date)
        .lte("work_date", period.end_date),
      supabaseAdmin
        .from("overtime_calculations")
        .select(
          "employee_id, daily_ot_minutes, weekly_ot_minutes, period_ot_minutes, late_night_minutes, holiday_minutes",
        )
        .gte("work_date", period.start_date)
        .lte("work_date", period.end_date),
    ]);

  const employeeRows = (employees ?? []) as Employee[];
  const shiftRows = (shifts ?? []) as ShiftPlan[];
  const attendanceRows = (attendanceLogs ?? []) as AttendanceLog[];
  const overtimeCalculations = (overtimeRows ?? []) as OvertimeCalculation[];

  const header = [
    "対象期間",
    "社員コード",
    "氏名",
    "部署",
    "所定労働時間",
    "実労働時間",
    "休憩時間",
    "法定内残業時間",
    "法定外残業時間",
    "深夜時間",
    "休日時間",
    "未確定シフト数",
  ];

  const rows = employeeRows.map((employee) => {
    const employeeShifts = shiftRows.filter((item) => item.employee_id === employee.id);
    const employeeAttendance = attendanceRows.filter((item) => item.employee_id === employee.id);
    const employeeOvertime = overtimeCalculations.filter(
      (item) => item.employee_id === employee.id,
    );
    const plannedMinutes = employeeShifts.reduce(
      (total, item) => total + item.planned_work_minutes,
      0,
    );
    const actualMinutes = employeeAttendance.reduce(
      (total, item) => total + item.actual_work_minutes,
      0,
    );
    const breakMinutes = employeeAttendance.reduce(
      (total, item) => total + item.actual_break_minutes,
      0,
    );
    const statutoryOutsideMinutes = employeeOvertime.reduce(
      (total, item) => total + item.daily_ot_minutes + item.weekly_ot_minutes + item.period_ot_minutes,
      0,
    );
    const lateNightMinutes = employeeOvertime.reduce(
      (total, item) => total + item.late_night_minutes,
      0,
    );
    const holidayMinutes = employeeOvertime.reduce(
      (total, item) => total + item.holiday_minutes,
      0,
    );
    const statutoryInsideMinutes = Math.max(0, actualMinutes - plannedMinutes - statutoryOutsideMinutes);
    const unconfirmedCount = employeeShifts.filter((item) => item.status !== "confirmed").length;

    return [
      period.label,
      employee.employee_code,
      employee.full_name,
      employee.department ?? "",
      hours(plannedMinutes),
      hours(actualMinutes),
      hours(breakMinutes),
      hours(statutoryInsideMinutes),
      hours(statutoryOutsideMinutes),
      hours(lateNightMinutes),
      hours(holidayMinutes),
      unconfirmedCount,
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => csvCell(cell)).join(","))
    .join("\r\n");
  const filename = `payroll-export-${period.start_date}-${period.end_date}.csv`;

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

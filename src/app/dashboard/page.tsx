import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileWarning,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  confirmLatestPeriodShifts,
  recalculateLatestPeriod,
} from "./actions";
import { EmbeddedShiftWorkbook } from "./embedded-shift-workbook";
import { AttendanceWorkbookImportForm } from "./import-form";
import { CorrectionList } from "./correction-list";

type Period = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  base_date: string;
  legal_total_minutes: number;
  status: string;
};

type Employee = {
  id: number;
  employee_code: string;
  full_name: string;
  department: string | null;
  weekly_legal_hours: number;
  is_variable_monthly: boolean;
};

type ShiftPlan = {
  id: number;
  employee_id: number;
  monthly_period_id: number;
  work_date: string;
  planned_work_minutes: number;
  planned_break_minutes: number;
  status: string;
};

type AttendanceLog = {
  id: number;
  employee_id: number;
  work_date: string;
  actual_work_minutes: number;
  actual_break_minutes: number;
  actual_start: string | null;
  actual_end: string | null;
};

type OvertimeCalculation = {
  id: number;
  employee_id: number;
  work_date: string;
  daily_ot_minutes: number;
  weekly_ot_minutes: number;
  period_ot_minutes: number;
  late_night_minutes: number;
  holiday_minutes: number;
};

type WarningItem = {
  id: string;
  severity: "error" | "warning" | "info";
  label: string;
  employeeName: string;
  employeeCode: string;
  detail: string;
  requirement: string;
};

const minutesToHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${date}T00:00:00+09:00`));

const formatDateLong = (date: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${date}T00:00:00+09:00`));

const getPeriodDays = (period: Period | null) => {
  if (!period) return 0;
  const start = new Date(`${period.start_date}T00:00:00+09:00`).getTime();
  const end = new Date(`${period.end_date}T00:00:00+09:00`).getTime();
  return Math.max(0, Math.floor((end - start) / 86_400_000) + 1);
};

const getEmployeeName = (employees: Employee[], employeeId: number) => {
  const employee = employees.find((item) => item.id === employeeId);
  return {
    name: employee?.full_name ?? "未登録の従業員",
    code: employee?.employee_code ?? `EMP-${employeeId}`,
  };
};

const buildWarnings = ({
  employees,
  shifts,
  attendanceLogs,
  overtimeCalculations,
}: {
  employees: Employee[];
  shifts: ShiftPlan[];
  attendanceLogs: AttendanceLog[];
  overtimeCalculations: OvertimeCalculation[];
}) => {
  const warnings: WarningItem[] = [];

  const overtimeRows = overtimeCalculations
    .filter(
      (item) =>
        item.daily_ot_minutes + item.weekly_ot_minutes + item.period_ot_minutes > 0,
    )
    .slice(0, 3);

  for (const item of overtimeRows) {
    const employee = getEmployeeName(employees, item.employee_id);
    const totalMinutes =
      item.daily_ot_minutes + item.weekly_ot_minutes + item.period_ot_minutes;

    warnings.push({
      id: `OT-${item.id}`,
      severity: "error",
      label: "法定枠超過",
      employeeName: employee.name,
      employeeCode: employee.code,
      detail: `${formatDate(item.work_date)} に ${minutesToHours(totalMinutes)}時間の法定外残業候補があります。日・週・対象期間の重複除外を確認してください。`,
      requirement: "REQ-007 / REQ-010",
    });
  }

  const missingClockOutRows = attendanceLogs
    .filter((item) => item.actual_start && !item.actual_end)
    .slice(0, 3);

  for (const item of missingClockOutRows) {
    const employee = getEmployeeName(employees, item.employee_id);

    warnings.push({
      id: `LOG-${item.id}`,
      severity: "info",
      label: "退勤打刻未完了",
      employeeName: employee.name,
      employeeCode: employee.code,
      detail: `${formatDate(item.work_date)} の退勤打刻が未完了です。実績確定前に確認してください。`,
      requirement: "REQ-005 / REQ-012",
    });
  }

  const longShiftRows = shifts
    .filter((item) => item.planned_work_minutes > 8 * 60)
    .slice(0, 3);

  for (const item of longShiftRows) {
    const employee = getEmployeeName(employees, item.employee_id);

    warnings.push({
      id: `SHIFT-${item.id}`,
      severity: "warning",
      label: "8時間超シフト",
      employeeName: employee.name,
      employeeCode: employee.code,
      detail: `${formatDate(item.work_date)} の所定労働時間が ${minutesToHours(item.planned_work_minutes)}時間です。事前特定済みか確認してください。`,
      requirement: "REQ-004 / REQ-009",
    });
  }

  return warnings.slice(0, 6);
};

const getSeverityClasses = (severity: WarningItem["severity"]) => {
  if (severity === "error") {
    return {
      dot: "bg-[#e73858]",
      badge: "bg-[#fff1f2] text-[#e73858]",
    };
  }

  if (severity === "warning") {
    return {
      dot: "bg-[#b45309]",
      badge: "bg-[#fffbeb] text-[#b45309]",
    };
  }

  return {
    dot: "bg-[#0457a7]",
    badge: "bg-[#eff6ff] text-[#0457a7]",
  };
};

function MetricCard({
  label,
  value,
  unit,
  note,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  note: string;
  tone?: "neutral" | "error" | "warning" | "success";
  icon: React.ReactNode;
}) {
  const toneClasses = {
    neutral: "text-gray-900 border-gray-200",
    error: "text-[#e73858] border-[#e73858]/30",
    warning: "text-[#b45309] border-[#b45309]/30",
    success: "text-[#047857] border-[#047857]/30 bg-[#f0fdf4]/40",
  };

  return (
    <section className={`rounded-lg border bg-white p-4 shadow-sm ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold text-gray-500">{label}</span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {unit && <span className="text-xs font-semibold text-gray-400">{unit}</span>}
      </div>
      <p className="mt-3 text-xs font-medium text-gray-500">{note}</p>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-[#047857]" />
      <p className="mt-3 text-sm font-bold text-gray-900">未解消の警告はありません</p>
      <p className="mt-1 text-xs text-gray-500">
        シフト確定前に、法定枠・制限対象者・打刻漏れの再計算を実行してください。
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    redirect("/login");
  }

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || profile.role !== "admin") {
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: user.primaryEmailAddress?.emailAddress || "",
        role: "admin",
      },
      { onConflict: "id" },
    );

    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!employee) {
      const fullName =
        user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "未設定";
      const employeeCode = `EMP-${userId.slice(-6).toUpperCase()}`;

      await supabaseAdmin.from("employees").insert({
        user_id: userId,
        employee_code: employeeCode,
        full_name: fullName,
      });
    }

    profile = { role: "admin" };
  }

  const [
    { data: periods },
    { data: employees },
    { data: shifts },
    { data: attendanceLogs },
    { data: overtimeCalculations },
    { data: correctionRequests },
  ] = await Promise.all([
    supabaseAdmin
      .from("monthly_periods")
      .select("id, label, start_date, end_date, base_date, legal_total_minutes, status")
      .order("start_date", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("employees")
      .select("id, employee_code, full_name, department, weekly_legal_hours, is_variable_monthly")
      .order("employee_code", { ascending: true }),
    supabaseAdmin
      .from("shift_plans")
      .select(
        "id, employee_id, monthly_period_id, work_date, planned_work_minutes, planned_break_minutes, status",
      ),
    supabaseAdmin
      .from("attendance_logs")
      .select("id, employee_id, work_date, actual_work_minutes, actual_break_minutes, actual_start, actual_end")
      .order("work_date", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("overtime_calculations")
      .select(
        "id, employee_id, work_date, daily_ot_minutes, weekly_ot_minutes, period_ot_minutes, late_night_minutes, holiday_minutes",
      )
      .order("work_date", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("attendance_correction_requests")
      .select("id, employee_id, work_date, requested_start, requested_end, requested_break_minutes, reason, status")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const period = (periods?.[0] ?? null) as Period | null;
  const employeeRows = (employees ?? []) as Employee[];
  const shiftRows = (shifts ?? []) as ShiftPlan[];
  const attendanceRows = (attendanceLogs ?? []) as AttendanceLog[];
  const overtimeRows = (overtimeCalculations ?? []) as OvertimeCalculation[];
  const periodShifts = period
    ? shiftRows.filter((item) => item.monthly_period_id === period.id)
    : shiftRows;
  const plannedMinutes = periodShifts.reduce(
    (total, item) => total + item.planned_work_minutes,
    0,
  );
  const unconfirmedShifts = periodShifts.filter((item) => item.status !== "confirmed");
  const legalFrameMinutes = period?.legal_total_minutes ?? 0;
  const legalFrameUsage =
    legalFrameMinutes > 0 ? Math.min(100, Math.round((plannedMinutes / legalFrameMinutes) * 100)) : 0;
  const totalOvertimeMinutes = overtimeRows.reduce(
    (total, item) =>
      total + item.daily_ot_minutes + item.weekly_ot_minutes + item.period_ot_minutes,
    0,
  );
  const warningItems = buildWarnings({
    employees: employeeRows,
    shifts: periodShifts,
    attendanceLogs: attendanceRows,
    overtimeCalculations: overtimeRows,
  });
  const weeklyBasis = employeeRows.some((item) => item.weekly_legal_hours === 44) ? "40/44" : "40";
  const periodDays = getPeriodDays(period);
  const payrollReady =
    periodShifts.length > 0 && unconfirmedShifts.length === 0 && warningItems.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-gray-900">
      <header className="z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-bold text-[#0457a7]">MINORU勤怠</p>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">管理者ダッシュボード</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-bold text-gray-900">
              {user.primaryEmailAddress?.emailAddress}
            </span>
            <span className="text-xs text-gray-400">権限: {profile?.role || "不明"}</span>
          </div>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 sm:p-6">
        <section className="flex flex-col justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-bold text-gray-400">対象期間</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  {period?.label ?? "対象期間が未設定です"}
                </h2>
                {period && (
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                    {formatDate(period.start_date)} - {formatDate(period.end_date)}
                  </span>
                )}
              </div>
            </div>
            <div className="hidden h-10 w-px bg-gray-200 md:block" />
            <div>
              <p className="text-xs font-bold text-gray-400">計算基準</p>
              <p className="mt-1 text-sm font-semibold text-gray-700">
                変形労働時間制 {weeklyBasis}時間/週
                {period ? ` / ${periodDays}日 / 総枠 ${minutesToHours(legalFrameMinutes)}時間` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs font-bold text-[#b45309]">
              未確定シフト {unconfirmedShifts.length}件
            </span>
            <span className="rounded border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600">
              状態: {period?.status === "confirmed" ? "確定済み" : "下書き"}
            </span>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="対象従業員"
            value={employeeRows.length}
            unit="名"
            note="制度対象者と管理対象者の合計"
            icon={<Users className="h-5 w-5" />}
          />
          <MetricCard
            label="法定枠使用率"
            value={`${legalFrameUsage}%`}
            note={`${minutesToHours(plannedMinutes)} / ${minutesToHours(legalFrameMinutes)} 時間`}
            tone={legalFrameUsage >= 100 ? "error" : legalFrameUsage >= 90 ? "warning" : "neutral"}
            icon={<ShieldAlert className="h-5 w-5" />}
          />
          <MetricCard
            label="警告キュー"
            value={warningItems.length}
            unit="件"
            note="上限超過・打刻漏れ・制限確認"
            tone={warningItems.length > 0 ? "warning" : "success"}
            icon={<FileWarning className="h-5 w-5" />}
          />
          <MetricCard
            label="給与出力"
            value={payrollReady ? "Ready" : "Review"}
            note={payrollReady ? "CSV出力前チェック完了" : "未確定または警告があります"}
            tone={payrollReady ? "success" : "warning"}
            icon={<Download className="h-5 w-5" />}
          />
        </section>

        <EmbeddedShiftWorkbook
          attendanceLogs={attendanceRows}
          employees={employeeRows}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="xl:col-span-2 flex flex-col gap-6">
            <CorrectionList requests={correctionRequests ?? []} employees={employeeRows} />

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">未解消の警告・アラート</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    REQ-007 / REQ-009 に対応する確認待ち項目です。
                  </p>
                </div>
                <AlertTriangle className="h-5 w-5 text-[#b45309]" />
              </div>
              {warningItems.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {warningItems.map((item) => {
                    const severity = getSeverityClasses(item.severity);

                    return (
                      <article
                        className="flex gap-4 p-5 transition-colors hover:bg-gray-50"
                        key={item.id}
                      >
                        <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${severity.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`rounded px-2 py-1 text-xs font-bold ${severity.badge}`}
                            >
                              {item.label}
                            </span>
                            <span className="text-xs font-semibold text-gray-400">
                              {item.requirement}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-bold text-gray-900">
                            {item.employeeName} ({item.employeeCode})
                          </p>
                          <p className="mt-1 text-sm leading-6 text-gray-600">{item.detail}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState />
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <AttendanceWorkbookImportForm />

            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <LockKeyhole className="h-4 w-4 text-[#0457a7]" />
                クイック操作
              </h3>
              <div className="mt-4 flex flex-col gap-3">
                <form action={confirmLatestPeriodShifts}>
                  <button
                    className="flex w-full items-center justify-between rounded-lg bg-[#0457a7] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#005a96]"
                    type="submit"
                  >
                    シフトを一括確定
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </form>
                <form action={recalculateLatestPeriod}>
                  <button
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
                    type="submit"
                  >
                    計算再実行
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </form>
                <Link
                  className="flex w-full items-center justify-between rounded-lg bg-[#e4c057] px-4 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-[#d7b44d]"
                  href="/dashboard/payroll-export"
                >
                  給与データ出力
                  <Download className="h-4 w-4" />
                </Link>
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-500">
                確定処理とCSV出力は、未解消警告と未確定シフトを確認してから実行してください。
              </p>
            </section>

            <section className="rounded-lg border border-[#0457a7]/10 bg-[#eff6ff] p-5">
              <h3 className="text-sm font-bold text-[#0457a7]">計算根拠</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-gray-600">
                    <CalendarDays className="h-4 w-4" />
                    起算日
                  </dt>
                  <dd className="font-bold text-gray-900">
                    {period ? formatDateLong(period.base_date) : "未設定"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-gray-600">
                    <Clock3 className="h-4 w-4" />
                    所定労働
                  </dt>
                  <dd className="font-bold text-gray-900">{minutesToHours(plannedMinutes)}時間</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-gray-600">
                    <ShieldAlert className="h-4 w-4" />
                    法定外候補
                  </dt>
                  <dd className="font-bold text-gray-900">
                    {minutesToHours(totalOvertimeMinutes)}時間
                  </dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-[#0457a7]/10 pt-4 text-xs leading-5 text-gray-600">
                日別、週別、対象期間全体の順に判定し、抽出済み時間の二重計上を避ける前提で表示しています。
              </p>
            </section>
          </aside>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white px-6 py-4 text-xs text-gray-400">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>MINORU Attendance Admin Console</span>
          <span>REQ-007 / REQ-008 / REQ-009 / REQ-011 / REQ-012</span>
        </div>
      </footer>
    </div>
  );
}

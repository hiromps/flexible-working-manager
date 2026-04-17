import { UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { AttendanceClock } from "./clock";

type Employee = {
  id: number;
  full_name: string;
  employee_code: string;
  department: string | null;
};

type AttendanceLog = {
  id: number;
  work_date: string;
  actual_start: string | null;
  actual_end: string | null;
  actual_work_minutes: number;
  actual_break_minutes: number;
  current_break_start: string | null;
};

type ShiftPlan = {
  planned_start: string | null;
  planned_end: string | null;
  planned_break_minutes: number;
  planned_work_minutes: number;
  status: string;
};

const getSupabaseAdmin = () =>
  createSupabaseAdmin(
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

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const shortTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
});

const formatTime = (value: string | null | undefined) =>
  value ? shortTimeFormatter.format(new Date(value)) : "--:--";

const formatDuration = (minutes: number | null | undefined) => {
  const safeMinutes = Math.max(0, Math.floor(minutes ?? 0));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (hours === 0) return `${rest}分`;
  return `${hours}時間${String(rest).padStart(2, "0")}分`;
};

const formatYmd = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day, 0, 0, 0)));
};

export default async function AttendancePage() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId) {
    redirect("/sign-in");
  }

  const supabaseAdmin = getSupabaseAdmin();

  let { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, employee_code, department")
    .eq("user_id", userId)
    .single();

  if (!employee && user) {
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        role: "employee",
      },
      { onConflict: "id" },
    );

    const fullName =
      user.fullName ?? user.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "未設定";
    const employeeCode = `EMP-${userId.slice(-6).toUpperCase()}`;

    const { data: newEmployee, error: createError } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: userId,
        employee_code: employeeCode,
        full_name: fullName,
      })
      .select("id, full_name, employee_code, department")
      .single();

    if (createError) {
      return (
        <main className="min-h-screen bg-[#f8fafc] p-6">
          <section className="mx-auto max-w-xl rounded-lg border border-[#e73858]/30 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-bold text-[#e73858]">社員情報の作成に失敗しました</h1>
            <p className="mt-2 text-sm text-gray-600">{createError.message}</p>
          </section>
        </main>
      );
    }

    employee = newEmployee;
  }

  if (!employee) {
    return (
      <main className="min-h-screen bg-[#f8fafc] p-6">
        <section className="mx-auto max-w-xl rounded-lg border border-[#e73858]/30 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-[#e73858]">社員情報が見つかりません</h1>
          <p className="mt-2 text-sm text-gray-600">管理者へ連絡してください。</p>
        </section>
      </main>
    );
  }

  const typedEmployee = employee as Employee;
  const todayStr = toJstYmd(new Date());
  const todayDate = dateFormatter.format(new Date(`${todayStr}T00:00:00+09:00`));

  const [{ data: todaysLog }, { data: todaysShifts }, { data: recentLogs }] = await Promise.all([
    supabaseAdmin
      .from("attendance_logs")
      .select(
        "id, work_date, actual_start, actual_end, actual_work_minutes, actual_break_minutes, current_break_start",
      )
      .eq("employee_id", typedEmployee.id)
      .eq("work_date", todayStr)
      .maybeSingle(),
    supabaseAdmin
      .from("shift_plans")
      .select("planned_start, planned_end, planned_break_minutes, planned_work_minutes, status")
      .eq("employee_id", typedEmployee.id)
      .eq("work_date", todayStr)
      .limit(1),
    supabaseAdmin
      .from("attendance_logs")
      .select("id, work_date, actual_start, actual_end, actual_work_minutes, actual_break_minutes, current_break_start")
      .eq("employee_id", typedEmployee.id)
      .order("work_date", { ascending: false })
      .limit(7),
  ]);

  const typedTodaysLog = (todaysLog ?? null) as AttendanceLog | null;
  const typedTodaysShift = (todaysShifts?.[0] ?? null) as ShiftPlan | null;
  const typedRecentLogs = (recentLogs ?? []) as AttendanceLog[];

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#0457a7]">社員勤怠</p>
            <h1 className="mt-1 text-2xl font-black text-gray-950">出勤・退勤打刻</h1>
            <p className="mt-1 text-sm text-gray-600">
              {typedEmployee.full_name} さん（{typedEmployee.employee_code}
              {typedEmployee.department ? ` / ${typedEmployee.department}` : ""}）
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="hidden sm:inline">{user?.primaryEmailAddress?.emailAddress}</span>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-5 py-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-[#0457a7]/20 bg-[#eff6ff] p-4">
            <p className="text-sm font-bold text-[#0457a7]">{todayDate}</p>
            <p className="mt-1 text-sm text-gray-700">
              この画面で押した出勤・退勤時刻が、管理者ダッシュボードと出勤簿の
              「就業時刻 出社 / 就業時刻 退社」に反映されます。
            </p>
          </section>

          <AttendanceClock
            employeeId={typedEmployee.id}
            todaysLog={typedTodaysLog}
            todaysShift={typedTodaysShift}
          />
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-gray-950">今日の予定</h2>
            {typedTodaysShift ? (
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-bold text-gray-500">シフト</dt>
                  <dd className="font-mono font-bold text-gray-950">
                    {formatTime(typedTodaysShift.planned_start)} - {formatTime(typedTodaysShift.planned_end)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-bold text-gray-500">予定休憩</dt>
                  <dd className="font-bold text-gray-950">
                    {formatDuration(typedTodaysShift.planned_break_minutes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-bold text-gray-500">予定労働</dt>
                  <dd className="font-bold text-gray-950">
                    {formatDuration(typedTodaysShift.planned_work_minutes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-bold text-gray-500">状態</dt>
                  <dd className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">
                    {typedTodaysShift.status === "confirmed" ? "確定済み" : "下書き"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 rounded-lg border border-[#b45309]/20 bg-[#fffbeb] p-3 text-sm font-medium text-[#b45309]">
                本日のシフト予定は未設定です。出勤が必要な場合は管理者へ確認してください。
              </p>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-gray-950">本日の実績</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="font-bold text-gray-500">出社</dt>
                <dd className="font-mono font-bold text-gray-950">
                  {formatTime(typedTodaysLog?.actual_start)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="font-bold text-gray-500">退社</dt>
                <dd className="font-mono font-bold text-gray-950">
                  {formatTime(typedTodaysLog?.actual_end)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="font-bold text-gray-500">休憩</dt>
                <dd className="font-bold text-gray-950">
                  {formatDuration(typedTodaysLog?.actual_break_minutes)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="font-bold text-gray-500">実労働</dt>
                <dd className="font-bold text-gray-950">
                  {formatDuration(typedTodaysLog?.actual_work_minutes)}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-950">直近の打刻</h2>
            <p className="mt-1 text-sm text-gray-500">過去7件の出勤・退勤実績です。</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-bold text-gray-500">
                  <th className="border-b border-gray-200 px-4 py-3">日付</th>
                  <th className="border-b border-gray-200 px-4 py-3">出社</th>
                  <th className="border-b border-gray-200 px-4 py-3">退社</th>
                  <th className="border-b border-gray-200 px-4 py-3">休憩</th>
                  <th className="border-b border-gray-200 px-4 py-3">実労働</th>
                  <th className="border-b border-gray-200 px-4 py-3">状態</th>
                </tr>
              </thead>
              <tbody>
                {typedRecentLogs.length > 0 ? (
                  typedRecentLogs.map((log) => (
                    <tr key={log.id} className="bg-white">
                      <td className="border-b border-gray-100 px-4 py-3 font-bold text-gray-950">
                        {formatYmd(log.work_date)}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 font-mono">
                        {formatTime(log.actual_start)}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 font-mono">
                        {formatTime(log.actual_end)}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3">
                        {formatDuration(log.actual_break_minutes)}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3">
                        {formatDuration(log.actual_work_minutes)}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3">
                        <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">
                          {log.actual_end ? "完了" : log.actual_start ? "勤務中" : "未打刻"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={6}>
                      まだ打刻履歴がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

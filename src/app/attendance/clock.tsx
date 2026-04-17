"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clockIn, clockOut, endBreak, startBreak } from "./actions";

type TodaysLog = {
  id: number;
  actual_start: string | null;
  actual_end: string | null;
  actual_work_minutes: number;
  actual_break_minutes: number;
  current_break_start: string | null;
};

type TodaysShift = {
  planned_start: string | null;
  planned_end: string | null;
  planned_break_minutes: number;
  planned_work_minutes: number;
  status: string;
} | null;

interface ClockProps {
  employeeId: number;
  todaysLog: TodaysLog | null;
  todaysShift: TodaysShift;
}

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "打刻処理中にエラーが発生しました。";

export function AttendanceClock({ employeeId, todaysLog, todaysShift }: ClockProps) {
  const router = useRouter();
  const [time, setTime] = useState(new Date());
  const [loadingAction, setLoadingAction] = useState<
    "clock-in" | "clock-out" | "break-start" | "break-end" | null
  >(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hasClockedIn = todaysLog !== null && todaysLog.actual_start !== null;
  const hasClockedOut = todaysLog !== null && todaysLog.actual_end !== null;
  const isOnBreak = todaysLog !== null && todaysLog.current_break_start !== null;
  const isLoading = loadingAction !== null;

  const liveBreakMinutes = useMemo(() => {
    if (!todaysLog) return 0;
    const storedBreakMinutes = todaysLog.actual_break_minutes ?? 0;

    if (!todaysLog.current_break_start) {
      return storedBreakMinutes;
    }

    const breakStart = new Date(todaysLog.current_break_start);
    return storedBreakMinutes + Math.max(0, Math.floor((time.getTime() - breakStart.getTime()) / 60_000));
  }, [time, todaysLog]);

  const liveWorkMinutes = useMemo(() => {
    if (!todaysLog?.actual_start) return 0;
    if (todaysLog.actual_end) return todaysLog.actual_work_minutes ?? 0;

    const start = new Date(todaysLog.actual_start);
    const elapsed = Math.max(0, Math.floor((time.getTime() - start.getTime()) / 60_000));
    return Math.max(0, elapsed - liveBreakMinutes);
  }, [liveBreakMinutes, time, todaysLog]);

  const status = hasClockedOut
    ? { label: "退勤済み", className: "bg-[#f0fdf4] text-[#047857] border-[#047857]/20" }
    : isOnBreak
      ? { label: "休憩中", className: "bg-[#fffbeb] text-[#b45309] border-[#b45309]/20" }
      : hasClockedIn
        ? { label: "勤務中", className: "bg-[#eff6ff] text-[#0457a7] border-[#0457a7]/20" }
        : { label: "出勤前", className: "bg-gray-50 text-gray-600 border-gray-200" };

  const runAction = async (
    action: "clock-in" | "clock-out" | "break-start" | "break-end",
    callback: () => Promise<void>,
  ) => {
    setLoadingAction(action);
    setErrorMsg("");

    try {
      await callback();
      router.refresh();
    } catch (error) {
      setErrorMsg(getErrorMessage(error));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleClockIn = () =>
    runAction("clock-in", async () => {
      await clockIn(employeeId);
    });

  const handleClockOut = () =>
    runAction("clock-out", async () => {
      if (!todaysLog) return;
      await clockOut(employeeId, todaysLog.id);
    });

  const handleStartBreak = () =>
    runAction("break-start", async () => {
      if (!todaysLog) return;
      await startBreak(employeeId, todaysLog.id);
    });

  const handleEndBreak = () =>
    runAction("break-end", async () => {
      if (!todaysLog) return;
      await endBreak(employeeId, todaysLog.id);
    });

  const buttonBase =
    "min-h-16 rounded-lg px-4 py-4 text-base font-bold transition-colors disabled:cursor-not-allowed";
  const primaryButton = `${buttonBase} bg-[#0457a7] text-white hover:bg-[#005a96] disabled:bg-gray-200 disabled:text-gray-400`;
  const darkButton = `${buttonBase} bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400`;
  const outlineButton = `${buttonBase} border border-[#b45309]/30 bg-[#fffbeb] text-[#b45309] hover:bg-[#fef3c7] disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400`;
  const activeBreakButton = `${buttonBase} bg-[#b45309] text-white hover:bg-[#92400e] disabled:bg-gray-200 disabled:text-gray-400`;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-gray-500">現在時刻</p>
          <div className="mt-2 font-mono text-5xl font-black text-gray-950 tabular-nums">
            {timeFormatter.format(time)}
          </div>
        </div>
        <span className={`w-fit rounded-lg border px-3 py-2 text-sm font-bold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="grid gap-4 py-5 lg:grid-cols-3">
        <div>
          <p className="text-xs font-bold text-gray-500">予定シフト</p>
          <p className="mt-1 font-mono text-lg font-bold text-gray-950">
            {todaysShift
              ? `${formatTime(todaysShift.planned_start)} - ${formatTime(todaysShift.planned_end)}`
              : "未設定"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {todaysShift
              ? `休憩 ${formatDuration(todaysShift.planned_break_minutes)} / 予定 ${formatDuration(
                  todaysShift.planned_work_minutes,
                )}`
              : "管理者が作成したシフト予定がまだありません。"}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500">実績打刻</p>
          <p className="mt-1 font-mono text-lg font-bold text-gray-950">
            {formatTime(todaysLog?.actual_start)} - {formatTime(todaysLog?.actual_end)}
          </p>
          <p className="mt-1 text-xs text-gray-500">出勤簿の「就業時刻 出社 / 退社」に反映されます。</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500">実労働時間</p>
          <p className="mt-1 text-lg font-bold text-gray-950">{formatDuration(liveWorkMinutes)}</p>
          <p className="mt-1 text-xs text-gray-500">休憩累計 {formatDuration(liveBreakMinutes)}</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-5 rounded-lg border border-[#e73858]/30 bg-[#fff1f2] p-3 text-sm font-bold text-[#e73858]">
          {errorMsg}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className={primaryButton}
          disabled={hasClockedIn || isLoading}
          onClick={handleClockIn}
          type="button"
        >
          {loadingAction === "clock-in" ? "出勤打刻中..." : "出勤する"}
        </button>
        <button
          className={darkButton}
          disabled={!hasClockedIn || hasClockedOut || isLoading}
          onClick={handleClockOut}
          type="button"
        >
          {loadingAction === "clock-out" ? "退勤打刻中..." : isOnBreak ? "休憩を終了して退勤する" : "退勤する"}
        </button>
      </div>

      {hasClockedIn && !hasClockedOut && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            className={outlineButton}
            disabled={isOnBreak || isLoading}
            onClick={handleStartBreak}
            type="button"
          >
            {loadingAction === "break-start" ? "休憩開始中..." : "休憩開始"}
          </button>
          <button
            className={activeBreakButton}
            disabled={!isOnBreak || isLoading}
            onClick={handleEndBreak}
            type="button"
          >
            {loadingAction === "break-end" ? "休憩終了中..." : "休憩終了"}
          </button>
        </div>
      )}

      <p className="mt-5 text-sm font-medium text-gray-600">
        {hasClockedOut
          ? "本日の勤怠は完了しました。必要な修正がある場合は管理者へ連絡してください。"
          : isOnBreak
            ? "休憩中です。業務に戻るときは休憩終了を押してください。"
            : hasClockedIn
              ? "勤務中です。退勤時刻は退勤ボタンを押した時刻で記録されます。"
              : "勤務を始めるときに出勤するを押してください。"}
      </p>
    </section>
  );
}

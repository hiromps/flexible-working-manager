"use client";

import { useState } from "react";
import { submitCorrectionRequest } from "./actions";

type LogProps = {
  id: number;
  work_date: string;
  actual_start: string | null;
  actual_end: string | null;
  actual_break_minutes: number;
};

export function CorrectionModal({
  employeeId,
  log,
}: {
  employeeId: number;
  log: LogProps;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  const [startTime, setStartTime] = useState(formatTime(log.actual_start));
  const [endTime, setEndTime] = useState(formatTime(log.actual_end));
  const [breakMins, setBreakMins] = useState(String(log.actual_break_minutes));
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      // time ("HH:MM") を ISO String に変換
      const baseDate = log.work_date;
      const startIso = startTime ? new Date(`${baseDate}T${startTime}:00+09:00`).toISOString() : null;
      const endIso = endTime ? new Date(`${baseDate}T${endTime}:00+09:00`).toISOString() : null;
      
      // もし日またぎ（終了時間が開始時間より早い場合）なら終了時間を翌日にする
      let finalEndIso = endIso;
      if (startIso && finalEndIso && new Date(finalEndIso) < new Date(startIso)) {
        const d = new Date(finalEndIso);
        d.setDate(d.getDate() + 1);
        finalEndIso = d.toISOString();
      }

      await submitCorrectionRequest(
        employeeId,
        log.work_date,
        log.id,
        startIso,
        finalEndIso,
        Number(breakMins) || 0,
        reason
      );
      
      alert("修正申請を送信しました。管理者の承認をお待ちください。");
      setIsOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
      >
        修正申請
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <h3 className="text-lg font-bold text-gray-900">打刻の修正申請</h3>
        <p className="mt-1 text-xs text-gray-500">{log.work_date} の打刻を修正します。</p>

        {errorMsg && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-xs font-bold text-gray-700">
              出社時刻
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-bold text-gray-700">
              退社時刻
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>
          
          <label className="block text-xs font-bold text-gray-700">
            休憩時間 (分)
            <input
              type="number"
              min="0"
              value={breakMins}
              onChange={(e) => setBreakMins(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="block text-xs font-bold text-gray-700">
            修正理由 <span className="text-red-500">*</span>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: 退勤の押し忘れのため"
              className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-[#0457a7] px-4 py-2 text-sm font-bold text-white hover:bg-[#005a96] disabled:bg-gray-400"
            >
              {loading ? "送信中..." : "申請する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

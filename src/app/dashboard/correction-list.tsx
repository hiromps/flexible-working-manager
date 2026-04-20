"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { approveCorrection, rejectCorrection } from "./actions";

type RequestType = {
  id: number;
  employee_id: number;
  work_date: string;
  requested_start: string | null;
  requested_end: string | null;
  requested_break_minutes: number;
  reason: string;
  status: string;
};

type EmployeeOption = {
  id: number;
  full_name: string;
  employee_code: string;
};

const formatTime = (isoString: string | null) => {
  if (!isoString) return "未打刻";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
};

export function CorrectionList({
  requests,
  employees,
}: {
  requests: RequestType[];
  employees: EmployeeOption[];
}) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = (id: number) => {
    startTransition(async () => {
      try {
        await approveCorrection(id);
        alert("承認しました。");
      } catch (err: any) {
        alert(err.message || "エラーが発生しました");
      }
    });
  };

  const handleReject = (id: number) => {
    startTransition(async () => {
      try {
        await rejectCorrection(id);
        alert("却下しました。");
      } catch (err: any) {
        alert(err.message || "エラーが発生しました");
      }
    });
  };

  if (!requests || requests.length === 0) {
    return null; // 保留中の申請がない場合は非表示にするか、「申請はありません」を表示する
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#0457a7]/20 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-[#eff6ff] px-5 py-4">
        <h3 className="text-sm font-bold text-[#0457a7]">打刻修正申請</h3>
        <p className="mt-1 text-xs text-gray-600">
          従業員からの打刻修正申請です。内容を確認し、承認または却下してください。
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {requests.map((req) => {
          const emp = employees.find((e) => e.id === req.employee_id);
          const empName = emp ? `${emp.full_name} (${emp.employee_code})` : "不明な従業員";
          return (
            <article key={req.id} className="p-5 transition-colors hover:bg-gray-50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {empName} <span className="ml-2 font-mono text-xs text-gray-500">{req.work_date}</span>
                  </p>
                  <p className="mt-2 font-mono text-sm text-gray-700">
                    出社: {formatTime(req.requested_start)} / 退社: {formatTime(req.requested_end)} / 休憩: {req.requested_break_minutes}分
                  </p>
                  <p className="mt-1 text-xs text-red-600 font-bold">理由: {req.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> 却下
                  </button>
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded border border-[#047857] bg-[#f0fdf4] px-3 py-1.5 text-xs font-bold text-[#047857] transition hover:bg-[#dcfce7] disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> 承認
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

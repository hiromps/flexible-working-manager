"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Settings2, X } from "lucide-react";
import { updateEmployeeComplianceFlags } from "./actions";

type EmployeeComplianceProps = {
  employee: {
    id: number;
    full_name: string;
    is_under_18: boolean;
    has_pregnancy_restriction: boolean;
    needs_care_consideration: boolean;
    care_notes: string | null;
  };
};

export function EmployeeComplianceForm({ employee }: EmployeeComplianceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ status: "success" | "error"; message: string } | null>(
    null,
  );

  const [isUnder18, setIsUnder18] = useState(employee.is_under_18);
  const [hasPregnancy, setHasPregnancy] = useState(employee.has_pregnancy_restriction);
  const [needsCare, setNeedsCare] = useState(employee.needs_care_consideration);
  const [careNotes, setCareNotes] = useState(employee.care_notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await updateEmployeeComplianceFlags(employee.id, {
        is_under_18: isUnder18,
        has_pregnancy_restriction: hasPregnancy,
        needs_care_consideration: needsCare,
        care_notes: careNotes.trim() || null,
      });
      if (res.status !== "idle") {
        setResult({ status: res.status, message: res.message });
      }
      if (res.status === "success") {
        setTimeout(() => setIsOpen(false), 1200);
      }
    });
  };

  const handleOpen = () => {
    setIsUnder18(employee.is_under_18);
    setHasPregnancy(employee.has_pregnancy_restriction);
    setNeedsCare(employee.needs_care_consideration);
    setCareNotes(employee.care_notes ?? "");
    setResult(null);
    setIsOpen(true);
  };

  const hasAnyFlag = employee.is_under_18 || employee.has_pregnancy_restriction || employee.needs_care_consideration;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="配慮設定"
        className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-bold transition-colors ${
          hasAnyFlag
            ? "border-[#b45309]/30 bg-[#fffbeb] text-[#b45309] hover:bg-[#fef3c7]"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
        }`}
      >
        <Settings2 className="h-3 w-3" />
        配慮設定
        {hasAnyFlag && (
          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#b45309]" />
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compliance-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2
                  id="compliance-modal-title"
                  className="text-sm font-bold text-gray-900"
                >
                  配慮フラグ設定
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">{employee.full_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="閉じる"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
              <fieldset className="flex flex-col gap-3">
                <legend className="sr-only">配慮フラグ</legend>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={isUnder18}
                    onChange={(e) => setIsUnder18(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#0457a7]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-gray-900">18歳未満</span>
                    <p className="mt-0.5 text-xs text-gray-500">
                      深夜労働・法定時間外の特定事業での就業制限が適用されます。
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={hasPregnancy}
                    onChange={(e) => setHasPregnancy(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#0457a7]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-gray-900">妊産婦制限</span>
                    <p className="mt-0.5 text-xs text-gray-500">
                      時間外・深夜・休日労働の制限（請求による）が適用されます。
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={needsCare}
                    onChange={(e) => setNeedsCare(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#0457a7]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-gray-900">介護・育児配慮</span>
                    <p className="mt-0.5 text-xs text-gray-500">
                      育児・介護を理由とした勤務時間への配慮が必要です。
                    </p>
                  </div>
                </label>
              </fieldset>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="care-notes"
                  className="text-xs font-semibold text-gray-700"
                >
                  配慮メモ（任意）
                </label>
                <textarea
                  id="care-notes"
                  value={careNotes}
                  onChange={(e) => setCareNotes(e.target.value)}
                  rows={3}
                  placeholder="特記事項があれば入力してください"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#0457a7] focus:outline-none focus:ring-2 focus:ring-[#0457a7]/20"
                />
              </div>

              {result && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    result.status === "success"
                      ? "bg-[#f0fdf4] text-[#047857]"
                      : "bg-[#fff1f2] text-[#e73858]"
                  }`}
                >
                  {result.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  {result.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-[#0457a7] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#005a96] disabled:opacity-50"
                >
                  {isPending ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

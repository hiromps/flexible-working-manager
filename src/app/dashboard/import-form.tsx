"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import {
  importAttendanceWorkbook,
  type DashboardActionState,
} from "./actions";

const initialState: DashboardActionState = {
  status: "idle",
  message: "",
};

export function AttendanceWorkbookImportForm() {
  const [state, formAction, pending] = useActionState(
    importAttendanceWorkbook,
    initialState,
  );

  return (
    <form action={formAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[#eff6ff] p-2 text-[#0457a7]">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">出勤簿インポート</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            `出勤簿.xlsx` の予定欄からシフト、実績欄から勤怠ログを作成します。
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="text-xs font-bold text-gray-600" htmlFor="attendanceWorkbook">
          出勤簿ファイル
        </label>
        <input
          accept=".xlsx"
          className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-[#0457a7] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
          id="attendanceWorkbook"
          name="attendanceWorkbook"
          required
          type="file"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-gray-600">
            締日シート
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              defaultValue="末日締"
              name="sheetName"
            >
              <option value="末日締">末日締</option>
              <option value="20日締">20日締</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-gray-600">
            週法定労働時間
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              defaultValue="40"
              name="weeklyLegalHours"
            >
              <option value="40">40時間</option>
              <option value="44">44時間</option>
            </select>
          </label>
        </div>

        <button
          className="mt-1 rounded-lg bg-[#0457a7] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#005a96] disabled:cursor-not-allowed disabled:bg-gray-300"
          disabled={pending}
          type="submit"
        >
          {pending ? "取り込み中..." : "出勤簿からシフトを作成"}
        </button>
      </div>

      {state.status !== "idle" && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            state.status === "success"
              ? "border-[#047857]/30 bg-[#f0fdf4] text-[#047857]"
              : "border-[#e73858]/30 bg-[#fff1f2] text-[#e73858]"
          }`}
        >
          <p className="font-bold">{state.message}</p>
          {state.details && state.details.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {state.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

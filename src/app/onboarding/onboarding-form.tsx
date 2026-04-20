"use client";

import { useActionState } from "react";
import { submitOnboarding, type OnboardingActionState } from "./actions";

export function OnboardingForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState(
    submitOnboarding,
    { status: "idle", message: "" } as OnboardingActionState
  );

  return (
    <>
      {state.status === "error" && (
        <div className="mb-6 rounded-lg border border-[#e73858]/30 bg-[#fff1f2] p-3 text-sm text-[#e73858]">
          <p className="font-bold">{state.message}</p>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="employeeCode" className="block text-sm font-bold text-gray-700">
            社員コード (管理者が登録済みの場合に入力)
          </label>
          <input
            type="text"
            id="employeeCode"
            name="employeeCode"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 font-mono focus:border-[#0457a7] focus:outline-none focus:ring-1 focus:ring-[#0457a7]"
            placeholder="EMP-12345"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="fullName" className="block text-sm font-bold text-gray-700">
            氏名 <span className="text-[#e73858]">*</span>
          </label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            defaultValue={initialName}
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-[#0457a7] focus:outline-none focus:ring-1 focus:ring-[#0457a7]"
            placeholder="山田 太郎"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="department" className="block text-sm font-bold text-gray-700">
            所属 (任意)
          </label>
          <input
            type="text"
            id="department"
            name="department"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-[#0457a7] focus:outline-none focus:ring-1 focus:ring-[#0457a7]"
            placeholder="営業部"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="weeklyLegalHours" className="block text-sm font-bold text-gray-700">
            週法定労働時間
          </label>
          <select
            id="weeklyLegalHours"
            name="weeklyLegalHours"
            defaultValue={40}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-[#0457a7] focus:outline-none focus:ring-1 focus:ring-[#0457a7]"
          >
            <option value={40}>40時間 (通常)</option>
            <option value={44}>44時間 (特例措置対象事業場)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#0457a7] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#005a96] disabled:bg-gray-400"
        >
          {pending ? "登録中..." : "登録して始める"}
        </button>
      </form>
    </>
  );
}

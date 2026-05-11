"use client";

import { useRouter } from "next/navigation";

type Period = {
  id: number;
  label: string;
  status: string;
};

const statusLabel: Record<string, string> = {
  draft: "下書き",
  confirmed: "確定済み",
  closed: "クローズ",
};

export function PeriodSelector({
  periods,
  selectedPeriodId,
}: {
  periods: Period[];
  selectedPeriodId: number | null;
}) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      router.push(`/dashboard?periodId=${value}`);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="period-selector"
        className="shrink-0 text-xs font-bold text-gray-500"
      >
        対象期間切替
      </label>
      <select
        id="period-selector"
        value={selectedPeriodId ?? ""}
        onChange={handleChange}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm focus:border-[#0457a7] focus:outline-none focus:ring-2 focus:ring-[#0457a7]/20"
      >
        {periods.length === 0 && (
          <option value="" disabled>
            期間が未設定です
          </option>
        )}
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.label}
            {period.status !== "draft" ? ` [${statusLabel[period.status] ?? period.status}]` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

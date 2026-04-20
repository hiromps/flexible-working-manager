export type ComplianceEmployeeInfo = {
  is_under_18: boolean;
  has_pregnancy_restriction: boolean;
  needs_care_consideration: boolean;
  care_notes?: string | null;
};

export type ComplianceWarning = {
  level: "error" | "warning";
  message: string;
  details?: string[];
};

const parseTime = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/u);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const workMinutes = (row: { dayType: string; plannedStart: string; plannedEnd: string; plannedBreakMinutes: number }) => {
  if (row.dayType !== "出勤") return 0;
  const start = parseTime(row.plannedStart);
  const end = parseTime(row.plannedEnd);
  if (start === null || end === null) return 0;
  const normalizedEnd = end <= start ? end + 24 * 60 : end;
  return Math.max(0, normalizedEnd - start - row.plannedBreakMinutes);
};

export const checkCompliance = (
  employee: ComplianceEmployeeInfo,
  rows: { workDate: string; dayType: string; plannedStart: string; plannedEnd: string; plannedBreakMinutes: number }[]
): ComplianceWarning[] => {
  const warnings: ComplianceWarning[] = [];

  const checkLimits = employee.is_under_18 || employee.has_pregnancy_restriction;
  if (checkLimits) {
    const reason = employee.is_under_18 ? "年少者" : "妊産婦制限対象者";
    
    // 日単位のチェック（1日8時間超過禁止）
    const overtimeDays = rows.filter(row => workMinutes(row) > 8 * 60);
    if (overtimeDays.length > 0) {
      warnings.push({
        level: "error",
        message: `${reason}のため、1日8時間を超えるシフトは組めません。`,
        details: overtimeDays.map(row => `${row.workDate}: ${Math.round(workMinutes(row) / 60 * 10) / 10}時間`)
      });
    }

    // 週単位のチェック（週40時間超過禁止）
    for (let weekStart = 0; weekStart < rows.length; weekStart += 7) {
      const weekRows = rows.slice(weekStart, weekStart + 7);
      if (weekRows.length < 7) continue;

      const weekTotal = weekRows.reduce((sum, row) => sum + workMinutes(row), 0);
      if (weekTotal > 40 * 60) {
        warnings.push({
          level: "error",
          message: `${reason}のため、1週40時間を超えるシフトは組めません。`,
          details: [`期間: ${weekRows[0].workDate} 〜 ${weekRows[weekRows.length - 1].workDate}, 合計: ${Math.round(weekTotal / 60 * 10) / 10}時間`]
        });
      }
    }
  }

  if (employee.needs_care_consideration) {
    warnings.push({
      level: "warning",
      message: "育児・介護等の配慮対象者です。シフト確定前に配慮事項を確認してください。",
      details: employee.care_notes ? [`配慮事項: ${employee.care_notes}`] : undefined
    });
  }

  return warnings;
};

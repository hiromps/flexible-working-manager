export type WorkTimeInput = {
  employeeId: number;
  workDate: string;
  plannedWorkMinutes: number;
  actualWorkMinutes: number;
};

export type OvertimeResult = {
  employeeId: number;
  workDate: string;
  dailyOtMinutes: number;
  weeklyOtMinutes: number;
  periodOtMinutes: number;
};

const DAILY_STATUTORY_MINUTES = 8 * 60;

const dateTime = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`).getTime();

const weekIndexFromPeriodStart = (periodStart: string, workDate: string) =>
  Math.floor((dateTime(workDate) - dateTime(periodStart)) / 86_400_000 / 7);

export const calculateLegalTotalMinutes = (weeklyLegalHours: number, calendarDays: number) =>
  Math.round((weeklyLegalHours * 60 * calendarDays) / 7);

export const calculateOvertime = ({
  rows,
  periodStart,
  legalTotalMinutes,
  weeklyLegalMinutes,
}: {
  rows: WorkTimeInput[];
  periodStart: string;
  legalTotalMinutes: number;
  weeklyLegalMinutes: number;
}) => {
  const sortedRows = [...rows].sort((a, b) => a.workDate.localeCompare(b.workDate));
  const results = new Map<string, OvertimeResult>();

  for (const row of sortedRows) {
    const dailyLimit =
      row.plannedWorkMinutes > DAILY_STATUTORY_MINUTES
        ? row.plannedWorkMinutes
        : DAILY_STATUTORY_MINUTES;

    results.set(row.workDate, {
      employeeId: row.employeeId,
      workDate: row.workDate,
      dailyOtMinutes: Math.max(0, row.actualWorkMinutes - dailyLimit),
      weeklyOtMinutes: 0,
      periodOtMinutes: 0,
    });
  }

  const weekGroups = new Map<number, WorkTimeInput[]>();
  for (const row of sortedRows) {
    const weekIndex = weekIndexFromPeriodStart(periodStart, row.workDate);
    weekGroups.set(weekIndex, [...(weekGroups.get(weekIndex) ?? []), row]);
  }

  for (const weekRows of weekGroups.values()) {
    const actualWeekMinutes = weekRows.reduce((total, row) => total + row.actualWorkMinutes, 0);
    const plannedWeekMinutes = weekRows.reduce((total, row) => total + row.plannedWorkMinutes, 0);
    const weeklyLimit =
      plannedWeekMinutes > weeklyLegalMinutes ? plannedWeekMinutes : weeklyLegalMinutes;
    const dailyExtracted = weekRows.reduce(
      (total, row) => total + (results.get(row.workDate)?.dailyOtMinutes ?? 0),
      0,
    );
    const weeklyOtMinutes = Math.max(0, actualWeekMinutes - weeklyLimit - dailyExtracted);
    const lastRow = weekRows[weekRows.length - 1];
    const result = results.get(lastRow.workDate);

    if (result) {
      result.weeklyOtMinutes = weeklyOtMinutes;
    }
  }

  const totalActualMinutes = sortedRows.reduce((total, row) => total + row.actualWorkMinutes, 0);
  const totalDailyOtMinutes = [...results.values()].reduce(
    (total, row) => total + row.dailyOtMinutes,
    0,
  );
  const totalWeeklyOtMinutes = [...results.values()].reduce(
    (total, row) => total + row.weeklyOtMinutes,
    0,
  );
  const periodOtMinutes = Math.max(
    0,
    totalActualMinutes - legalTotalMinutes - totalDailyOtMinutes - totalWeeklyOtMinutes,
  );
  const lastRow = sortedRows[sortedRows.length - 1];

  if (lastRow) {
    const result = results.get(lastRow.workDate);
    if (result) {
      result.periodOtMinutes = periodOtMinutes;
    }
  }

  return [...results.values()];
};

"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Bot, Save, WandSparkles } from "lucide-react";
import { calculateLegalTotalMinutes, calculateOvertime } from "@/lib/attendance/overtime";
import {
  getAttendanceLogs,
  saveEmbeddedShiftWorkbook,
  type DashboardActionState,
} from "./actions";

type EmployeeOption = {
  id: number;
  employee_code: string;
  full_name: string;
  department: string | null;
  weekly_legal_hours: number;
};

type AttendanceLog = {
  id: number;
  employee_id: number;
  work_date: string;
  actual_work_minutes: number;
  actual_break_minutes: number;
  actual_start: string | null;
  actual_end: string | null;
};

type ShiftWorkbookRow = {
  workDate: string;
  weekday: string;
  dayType: string;
  plannedStart: string;
  plannedEnd: string;
  plannedBreakMinutes: number;
};

const initialState: DashboardActionState = {
  status: "idle",
  message: "",
};

const dayTypes = ["出勤", "休日", "有給", "振休", "休業", "欠勤"];
const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

const toYmd = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;

const parseTime = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/u);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const workMinutes = (row: ShiftWorkbookRow) => {
  if (row.dayType !== "出勤") return 0;
  const start = parseTime(row.plannedStart);
  const end = parseTime(row.plannedEnd);
  if (start === null || end === null) return 0;
  const normalizedEnd = end <= start ? end + 24 * 60 : end;
  return Math.max(0, normalizedEnd - start - row.plannedBreakMinutes);
};

const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

const formatTime = (isoString: string | null) => {
  if (!isoString) return "未打刻";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(isoString));
};

const getPeriodDates = (year: number, month: number, closingRule: string) => {
  if (closingRule === "20日締") {
    return {
      start: new Date(Date.UTC(year, month - 2, 21)),
      end: new Date(Date.UTC(year, month - 1, 20)),
    };
  }

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
};

const generateBlankRows = (year: number, month: number, closingRule: string) => {
  const { start, end } = getPeriodDates(year, month, closingRule);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + index),
    );
    const weekday = weekdays[date.getUTCDay()];

    return {
      workDate: toYmd(date),
      weekday,
      dayType: "休日",
      plannedStart: "",
      plannedEnd: "",
      plannedBreakMinutes: 0,
    };
  });
};

const applyAiShiftRules = ({
  rows,
  weeklyLegalHours,
  fetchedLogs,
  employeeId,
  defaultStartTime,
  defaultEndTime,
  defaultBreakMinutes,
}: {
  rows: ShiftWorkbookRow[];
  weeklyLegalHours: number;
  fetchedLogs: AttendanceLog[];
  employeeId: number;
  defaultStartTime: string;
  defaultEndTime: string;
  defaultBreakMinutes: number;
}) => {
  const existingPatterns = rows
    .filter((r) => r.dayType === "出勤" && r.plannedStart && r.plannedEnd)
    .map((r) => ({
      start: r.plannedStart,
      end: r.plannedEnd,
      breakMins: r.plannedBreakMinutes,
    }));

  const uniquePatterns: Array<{ start: string; end: string; breakMins: number }> = [];
  const seen = new Set<string>();
  for (const p of existingPatterns) {
    const key = `${p.start}-${p.end}-${p.breakMins}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePatterns.push(p);
    }
  }

  const defaultPatterns = [
    { start: defaultStartTime, end: defaultEndTime, breakMins: defaultBreakMinutes },
  ];

  const shiftPatterns = uniquePatterns.length > 0 ? uniquePatterns : defaultPatterns;

  const workingRows = rows.map((row, index) => {
    const log = fetchedLogs.find((l) => l.employee_id === employeeId && l.work_date === row.workDate);
    if (log && typeof log.actual_work_minutes === "number" && log.actual_work_minutes > 0) {
      return { ...row };
    }

    const isWeekend = row.weekday === "土" || row.weekday === "日";
    
    // 既存の入力がある場合はそれを活かす
    const hasExistingInput = row.dayType === "出勤" && row.plannedStart && row.plannedEnd;
    if (hasExistingInput) {
      return { ...row };
    }

    // 未入力の平日はパターンから割り当てる
    const pattern = shiftPatterns[index % shiftPatterns.length];

    return {
      ...row,
      dayType: isWeekend ? "休日" : "出勤",
      plannedStart: isWeekend ? "" : pattern.start,
      plannedEnd: isWeekend ? "" : pattern.end,
      plannedBreakMinutes: isWeekend ? 0 : pattern.breakMins,
    };
  });

  const weeklyLegalMinutes = weeklyLegalHours * 60;
  const legalTotalMinutes = Math.round((weeklyLegalHours * 60 * workingRows.length) / 7);

  for (let weekStart = 0; weekStart < workingRows.length; weekStart += 7) {
    const weekRows = workingRows.slice(weekStart, weekStart + 7);
    if (weekRows.length < 7) {
      continue;
    }

    let weekTotal = weekRows.reduce((total, row) => {
      const log = fetchedLogs.find((l) => l.employee_id === employeeId && l.work_date === row.workDate);
      const actual = log?.actual_work_minutes ?? 0;
      return total + (actual > 0 ? actual : workMinutes(row));
    }, 0);

    for (let index = weekRows.length - 1; index >= 0 && weekTotal > weeklyLegalMinutes; index -= 1) {
      const globalIndex = weekStart + index;
      const row = workingRows[globalIndex];
      const log = fetchedLogs.find((l) => l.employee_id === employeeId && l.work_date === row.workDate);
      
      // 打刻済みの日は変更しない（触らない）
      if (row.dayType !== "出勤" || (log && typeof log.actual_work_minutes === "number" && log.actual_work_minutes > 0)) continue;

      const overMinutes = weekTotal - weeklyLegalMinutes;
      const currentWorkMinutes = workMinutes(row);

      if (currentWorkMinutes <= overMinutes) {
        weekTotal -= currentWorkMinutes;
        workingRows[globalIndex] = {
          ...row,
          dayType: "休日",
          plannedStart: "",
          plannedEnd: "",
          plannedBreakMinutes: 0,
        };
      } else {
        const newWorkMinutes = currentWorkMinutes - overMinutes;
        weekTotal -= overMinutes;
        
        const startMins = parseTime(row.plannedStart) ?? 480; // default 08:00
        const newEndMins = startMins + newWorkMinutes + row.plannedBreakMinutes;
        const endH = Math.floor(newEndMins / 60) % 24;
        const endM = newEndMins % 60;
        
        workingRows[globalIndex] = {
          ...row,
          plannedEnd: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        };
      }
    }
  }

  let total = workingRows.reduce((sum, row) => {
    const log = fetchedLogs.find((l) => l.employee_id === employeeId && l.work_date === row.workDate);
    const actual = log?.actual_work_minutes ?? 0;
    return sum + (actual > 0 ? actual : workMinutes(row));
  }, 0);

  for (let index = workingRows.length - 1; index >= 0 && total > legalTotalMinutes; index -= 1) {
    const row = workingRows[index];
    const log = fetchedLogs.find((l) => l.employee_id === employeeId && l.work_date === row.workDate);
    
    if (row.dayType !== "出勤" || (log && typeof log.actual_work_minutes === "number" && log.actual_work_minutes > 0)) continue;

    const overMinutes = total - legalTotalMinutes;
    const currentWorkMinutes = workMinutes(row);

    if (currentWorkMinutes <= overMinutes) {
      total -= currentWorkMinutes;
      workingRows[index] = {
        ...row,
        dayType: "休日",
        plannedStart: "",
        plannedEnd: "",
        plannedBreakMinutes: 0,
      };
    } else {
      const newWorkMinutes = currentWorkMinutes - overMinutes;
      total -= overMinutes;
      
      const startMins = parseTime(row.plannedStart) ?? 480;
      const newEndMins = startMins + newWorkMinutes + row.plannedBreakMinutes;
      const endH = Math.floor(newEndMins / 60) % 24;
      const endM = newEndMins % 60;
      
      workingRows[index] = {
        ...row,
        plannedEnd: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      };
    }
  }

  return workingRows;
};

export function EmbeddedShiftWorkbook({
  employees,
  attendanceLogs,
}: {
  employees: EmployeeOption[];
  attendanceLogs: AttendanceLog[];
}) {
  const now = new Date();
  const [state, formAction, pending] = useActionState(
    saveEmbeddedShiftWorkbook,
    initialState,
  );
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [closingRule, setClosingRule] = useState("末日締");
  const [weeklyLegalHours, setWeeklyLegalHours] = useState(40);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? 0);
  const [defaultStartTime, setDefaultStartTime] = useState("08:00");
  const [defaultEndTime, setDefaultEndTime] = useState("17:00");
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState(60);
  const selectedEmployee = employees.find((employee) => employee.id === employeeId);
  const [employeeCode, setEmployeeCode] = useState(selectedEmployee?.employee_code ?? "");
  const [fullName, setFullName] = useState(selectedEmployee?.full_name ?? "");
  const [department, setDepartment] = useState(selectedEmployee?.department ?? "");
  const [rows, setRows] = useState<ShiftWorkbookRow[]>(() =>
    generateBlankRows(now.getFullYear(), now.getMonth() + 1, "末日締"),
  );
  const [fetchedLogs, setFetchedLogs] = useState<AttendanceLog[]>(attendanceLogs);

  useEffect(() => {
    if (employeeId === 0) {
      setFetchedLogs([]);
      return;
    }

    const { start, end } = getPeriodDates(year, month, closingRule);
    const startDateText = toYmd(start);
    const endDateText = toYmd(end);

    getAttendanceLogs(employeeId, startDateText, endDateText)
      .then((logs) => setFetchedLogs(logs as AttendanceLog[]))
      .catch(console.error);
  }, [employeeId, year, month, closingRule]);

  const startDateText = useMemo(() => {
    const { start } = getPeriodDates(year, month, closingRule);
    return toYmd(start);
  }, [year, month, closingRule]);

  const calendarDays = rows.length;
  const legalTotalMinutes = useMemo(
    () => calculateLegalTotalMinutes(weeklyLegalHours, calendarDays),
    [weeklyLegalHours, calendarDays]
  );

  const overtimeResults = useMemo(() => {
    if (employeeId === 0 || rows.length === 0) return [];
    const inputs = rows.map((row) => {
      const log = fetchedLogs.find((l) => l.employee_id === employeeId && l.work_date === row.workDate);
      const planned = workMinutes(row);
      const actual = log && typeof log.actual_work_minutes === "number" && log.actual_work_minutes > 0
        ? log.actual_work_minutes
        : planned;
      return {
        employeeId,
        workDate: row.workDate,
        plannedWorkMinutes: planned,
        actualWorkMinutes: actual,
      };
    });

    return calculateOvertime({
      rows: inputs,
      periodStart: startDateText,
      legalTotalMinutes,
      weeklyLegalMinutes: weeklyLegalHours * 60,
    });
  }, [rows, fetchedLogs, employeeId, startDateText, legalTotalMinutes, weeklyLegalHours]);

  const effectiveTotalMinutes = useMemo(() => {
    return rows.reduce((sum, row) => {
      const log = fetchedLogs.find((l) => l.employee_id === employeeId && l.work_date === row.workDate);
      const planned = workMinutes(row);
      const actual = log && typeof log.actual_work_minutes === "number" && log.actual_work_minutes > 0
        ? log.actual_work_minutes
        : planned;
      return sum + actual;
    }, 0);
  }, [rows, fetchedLogs, employeeId]);

  const totalOverMinutes = useMemo(() => {
    return overtimeResults.reduce(
      (sum, r) => sum + r.dailyOtMinutes + r.weeklyOtMinutes + r.periodOtMinutes,
      0
    );
  }, [overtimeResults]);

  const workdayCount = rows.filter((row) => row.dayType === "出勤").length;
  const holidayCount = rows.filter((row) => row.dayType === "休日").length;
  const rowsJson = useMemo(() => JSON.stringify(rows), [rows]);

  const resetPeriodRows = (nextYear: number, nextMonth: number, nextClosingRule: string) => {
    setRows(generateBlankRows(nextYear, nextMonth, nextClosingRule));
  };

  const updateRow = (index: number, patch: Partial<ShiftWorkbookRow>) => {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, ...patch };
        if (patch.dayType && patch.dayType !== "出勤") {
          next.plannedStart = "";
          next.plannedEnd = "";
          next.plannedBreakMinutes = 0;
        }
        if (patch.dayType === "出勤" && !row.plannedStart && !row.plannedEnd) {
          next.plannedStart = defaultStartTime;
          next.plannedEnd = defaultEndTime;
          next.plannedBreakMinutes = defaultBreakMinutes;
        }
        return next;
      }),
    );
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-gray-100 p-5 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#0457a7]" />
            <h3 className="text-base font-bold text-gray-900">Excel形式 AIシフト表</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            管理者は予定シフトを作成します。就業時刻の出社・退社は社員の出勤画面で打刻され、
            出勤簿の実績欄へ反映されます。
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0457a7] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#005a96]"
          onClick={() => setRows(applyAiShiftRules({ rows, weeklyLegalHours, fetchedLogs, employeeId, defaultStartTime, defaultEndTime, defaultBreakMinutes }))}
          type="button"
        >
          <WandSparkles className="h-4 w-4" />
          AI自動作成
        </button>
      </div>

      <form action={formAction}>
        <input name="rowsJson" type="hidden" value={rowsJson} />
        <input name="year" type="hidden" value={year} />
        <input name="month" type="hidden" value={month} />
        <input name="closingRule" type="hidden" value={closingRule} />
        <input name="weeklyLegalHours" type="hidden" value={weeklyLegalHours} />
        <input name="employeeId" type="hidden" value={employeeId} />
        <input name="employeeCode" type="hidden" value={employeeCode} />
        <input name="fullName" type="hidden" value={fullName} />
        <input name="department" type="hidden" value={department} />

        <div className="grid gap-4 border-b border-gray-100 p-5 lg:grid-cols-12">
          <label className="grid gap-1 text-xs font-bold text-gray-600 lg:col-span-2">
            年
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
              max={2100}
              min={2000}
              onChange={(event) => {
                const nextYear = Number(event.target.value);
                setYear(nextYear);
                resetPeriodRows(nextYear, month, closingRule);
              }}
              type="number"
              value={year}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-gray-600 lg:col-span-2">
            月
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
              onChange={(event) => {
                const nextMonth = Number(event.target.value);
                setMonth(nextMonth);
                resetPeriodRows(year, nextMonth, closingRule);
              }}
              value={month}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}月
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-gray-600 lg:col-span-2">
            締日
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
              onChange={(event) => {
                setClosingRule(event.target.value);
                resetPeriodRows(year, month, event.target.value);
              }}
              value={closingRule}
            >
              <option value="末日締">末日締</option>
              <option value="20日締">20日締</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-gray-600 lg:col-span-2">
            週法定
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
              onChange={(event) => setWeeklyLegalHours(Number(event.target.value))}
              value={weeklyLegalHours}
            >
              <option value={40}>40時間</option>
              <option value={44}>44時間</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-gray-600 lg:col-span-4">
            既存社員
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
              onChange={(event) => {
                const nextId = Number(event.target.value);
                setEmployeeId(nextId);
                const employee = employees.find((item) => item.id === nextId);
                if (employee) {
                  setEmployeeCode(employee.employee_code);
                  setFullName(employee.full_name);
                  setDepartment(employee.department ?? "");
                  setWeeklyLegalHours(employee.weekly_legal_hours);
                }
              }}
              value={employeeId}
            >
              <option value={0}>新規社員として作成</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_code} / {employee.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-gray-600 lg:col-span-3">
            社員ID
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              onChange={(event) => setEmployeeCode(event.target.value)}
              value={employeeCode}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-gray-600 lg:col-span-5">
            氏名
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              onChange={(event) => setFullName(event.target.value)}
              value={fullName}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-gray-600 lg:col-span-4">
            所属
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              onChange={(event) => setDepartment(event.target.value)}
              value={department}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-gray-100 bg-gray-50 p-4 text-xs sm:grid-cols-4">
          <div>
            <p className="font-bold text-gray-500">出勤日数</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{workdayCount}日</p>
          </div>
          <div>
            <p className="font-bold text-gray-500">休日数</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{holidayCount}日</p>
          </div>
          <div>
            <p className="font-bold text-gray-500">総労働時間 (実績込み)</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{hours(effectiveTotalMinutes)}時間</p>
          </div>
          <div>
            <p className="font-bold text-gray-500">法定総枠</p>
            <p className={`mt-1 text-lg font-bold ${totalOverMinutes > 0 ? "text-[#e73858]" : "text-[#047857]"}`}>
              {hours(legalTotalMinutes)}時間
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#eff6ff] text-left text-xs text-[#0457a7]">
                <th className="border border-gray-200 px-2 py-2">日</th>
                <th className="border border-gray-200 px-2 py-2">曜日</th>
                <th className="border border-gray-200 px-2 py-2">区分</th>
                <th className="border border-gray-200 px-2 py-2">就業時刻 出社</th>
                <th className="border border-gray-200 px-2 py-2">就業時刻 退社</th>
                <th className="border border-gray-200 px-2 py-2">シフト開始</th>
                <th className="border border-gray-200 px-2 py-2">シフト終了</th>
                <th className="border border-gray-200 px-2 py-2">休憩時間</th>
                <th className="border border-gray-200 px-2 py-2">シフト時間</th>
                <th className="border border-gray-200 px-2 py-2">法定時間外</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rowWorkMinutes = workMinutes(row);
                const isHoliday = row.dayType !== "出勤";
                const log = fetchedLogs.find(
                  (l) => l.employee_id === employeeId && l.work_date === row.workDate
                );
                const otResult = overtimeResults.find((r) => r.workDate === row.workDate);
                const combinedOverMinutes = otResult 
                  ? otResult.dailyOtMinutes + otResult.weeklyOtMinutes + otResult.periodOtMinutes 
                  : 0;

                return (
                  <tr className={isHoliday ? "bg-gray-50" : "bg-white"} key={row.workDate}>
                    <td className="border border-gray-200 px-2 py-1 font-mono text-xs">{row.workDate}</td>
                    <td className="border border-gray-200 px-2 py-1 text-center">{row.weekday}</td>
                    <td className="border border-gray-200 px-2 py-1">
                      <select
                        className="w-full rounded border border-gray-200 px-2 py-1"
                        onChange={(event) => updateRow(index, { dayType: event.target.value })}
                        value={row.dayType}
                      >
                        {dayTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-xs font-bold text-gray-600">
                      {log?.actual_start ? formatTime(log.actual_start) : "未打刻"}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-xs font-bold text-gray-600">
                      {log?.actual_end ? formatTime(log.actual_end) : "未打刻"}
                    </td>
                    <td className="border border-gray-200 px-2 py-1">
                      <input
                        className="w-full rounded border border-gray-200 px-2 py-1 font-mono"
                        disabled={isHoliday}
                        onChange={(event) => updateRow(index, { plannedStart: event.target.value })}
                        type="time"
                        value={row.plannedStart}
                      />
                    </td>
                    <td className="border border-gray-200 px-2 py-1">
                      <input
                        className="w-full rounded border border-gray-200 px-2 py-1 font-mono"
                        disabled={isHoliday}
                        onChange={(event) => updateRow(index, { plannedEnd: event.target.value })}
                        type="time"
                        value={row.plannedEnd}
                      />
                    </td>
                    <td className="border border-gray-200 px-2 py-1">
                      <input
                        className="w-20 rounded border border-gray-200 px-2 py-1 text-right font-mono"
                        disabled={isHoliday}
                        min={0}
                        onChange={(event) =>
                          updateRow(index, { plannedBreakMinutes: Number(event.target.value) })
                        }
                        type="number"
                        value={row.plannedBreakMinutes}
                      />
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono">
                      {hours(rowWorkMinutes)}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono text-gray-400">
                      {combinedOverMinutes > 0 ? hours(combinedOverMinutes) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-gray-100 p-5 sm:flex-row sm:items-center">
          <div className="text-xs text-gray-500">
            {totalOverMinutes > 0 ? (
              <span className="font-bold text-[#e73858]">
                実績込みで法定枠（週単位・総枠）を {hours(totalOverMinutes)}時間 超過しています。未打刻のシフトを調整してください。
              </span>
            ) : (
              <span className="font-bold text-[#047857]">実績込みでも法定枠内に収まっています。</span>
            )}
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e4c057] px-4 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-[#d7b44d] disabled:cursor-not-allowed disabled:bg-gray-300"
            disabled={pending}
            type="submit"
          >
            <Save className="h-4 w-4" />
            {pending ? "保存中..." : "シフト表を保存"}
          </button>
        </div>

        {state.status !== "idle" && (
          <div
            className={`mx-5 mb-5 rounded-lg border p-3 text-sm ${
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
    </section>
  );
}

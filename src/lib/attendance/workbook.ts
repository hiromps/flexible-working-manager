import { strFromU8, unzipSync } from "fflate";

export type ClosingRule = "末日締" | "20日締";

export type AttendanceWorkbookDay = {
  workDate: string;
  dayType: string;
  plannedStartMinutes: number | null;
  plannedEndMinutes: number | null;
  plannedBreakMinutes: number;
  plannedWorkMinutes: number;
  actualStartMinutes: number | null;
  actualEndMinutes: number | null;
  actualBreakMinutes: number;
  actualWorkMinutes: number;
};

export type ParsedAttendanceWorkbook = {
  sheetName: ClosingRule;
  year: number;
  month: number;
  employeeCode: string;
  fullName: string;
  department: string | null;
  period: {
    label: string;
    startDate: string;
    endDate: string;
    baseDate: string;
    calendarDays: number;
  };
  days: AttendanceWorkbookDay[];
  importNotes: string[];
};

const DEFAULT_WORK_START_ROW = 13;
const MAX_WORK_DAYS = 31;

type ParsedCell = {
  type: string | null;
  raw: string;
};

type ParsedSheet = Map<string, ParsedCell>;

const decodeXml = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/_x000D_/g, "\n");

const getAttribute = (source: string, name: string) => {
  const match = source.match(new RegExp(`${name}="([^"]*)"`, "u"));
  return match ? decodeXml(match[1]) : null;
};

const collectTextNodes = (xml: string) => {
  const withoutPhonetics = xml
    .replace(/<rPh\b[\s\S]*?<\/rPh>/gu, "")
    .replace(/<phoneticPr\b[^>]*\/>/gu, "");
  const texts = [...withoutPhonetics.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gu)].map((match) =>
    decodeXml(match[1]),
  );

  return texts.join("");
};

const parseSharedStrings = (xml: string | null) => {
  if (!xml) return [];

  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gu)].map((match) =>
    collectTextNodes(match[1]),
  );
};

const parseSheet = (xml: string, sharedStrings: string[]): ParsedSheet => {
  const cells: ParsedSheet = new Map();

  for (const match of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gu)) {
    const attrs = match[1];
    const body = match[2];
    const address = getAttribute(attrs, "r");
    if (!address) continue;

    const type = getAttribute(attrs, "t");
    const valueMatch = body.match(/<v>([\s\S]*?)<\/v>/u);
    const inlineText = type === "inlineStr" ? collectTextNodes(body) : "";
    const raw = valueMatch ? decodeXml(valueMatch[1]) : inlineText;

    if (type === "s") {
      const index = Number(raw);
      cells.set(address, {
        type,
        raw: Number.isInteger(index) ? sharedStrings[index] ?? "" : raw,
      });
    } else {
      cells.set(address, { type, raw });
    }
  }

  return cells;
};

const getWorkbookSheetPaths = (files: Record<string, Uint8Array>) => {
  const workbookXml = files["xl/workbook.xml"] ? strFromU8(files["xl/workbook.xml"]) : "";
  const relsXml = files["xl/_rels/workbook.xml.rels"]
    ? strFromU8(files["xl/_rels/workbook.xml.rels"])
    : "";
  const relationships = new Map<string, string>();

  for (const match of relsXml.matchAll(/<Relationship\b([^>]*)\/>/gu)) {
    const attrs = match[1];
    const id = getAttribute(attrs, "Id");
    const target = getAttribute(attrs, "Target");
    if (!id || !target) continue;
    relationships.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }

  const sheets = new Map<string, string>();
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/gu)) {
    const attrs = match[1];
    const name = getAttribute(attrs, "name");
    const relationshipId = getAttribute(attrs, "r:id");
    const target = relationshipId ? relationships.get(relationshipId) : null;
    if (name && target) {
      sheets.set(name, target.replace(/xl\/xl\//u, "xl/"));
    }
  }

  return sheets;
};

const cellText = (sheet: ParsedSheet, address: string) => {
  const cell = sheet.get(address);
  if (!cell) return "";
  return cell.raw.trim();
};

const cellNumber = (sheet: ParsedSheet, address: string) => {
  const cell = sheet.get(address);
  if (!cell) return null;
  const parsed = Number(cell.raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const cellMinutes = (sheet: ParsedSheet, address: string) => {
  const cell = sheet.get(address);
  if (!cell) return null;

  const numberValue = Number(cell.raw);
  if (Number.isFinite(numberValue)) {
    return Math.round(numberValue * 24 * 60);
  }

  const match = cell.raw.trim().match(/^(-)?(\d{1,3}):(\d{2})$/u);
  if (!match) return null;

  const sign = match[1] ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
};

const positiveMinutes = (value: number | null) => Math.max(0, value ?? 0);

const dateToYmd = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

const daysBetweenInclusive = (start: Date, end: Date) =>
  Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

const getPeriodDates = (sheetName: ClosingRule, year: number, month: number) => {
  if (sheetName === "20日締") {
    const start = new Date(Date.UTC(year, month - 2, 21));
    const end = new Date(Date.UTC(year, month - 1, 20));
    return { start, end, base: start };
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end, base: start };
};

const diffClockMinutes = (start: number | null, end: number | null) => {
  if (start === null || end === null) return 0;
  const normalizedEnd = end <= start ? end + 24 * 60 : end;
  return Math.max(0, normalizedEnd - start);
};

const normalizeDayType = (value: string) => {
  if (!value) return "";
  return value.replace(/\s/g, "").replace("（", "(").replace("）", ")");
};

const shouldCreateShift = (dayType: string, plannedWorkMinutes: number) => {
  const normalized = normalizeDayType(dayType);
  return normalized === "出勤" || normalized === "休業(時間)" || plannedWorkMinutes > 0;
};

const shouldCreateAttendanceLog = (start: number | null, end: number | null) =>
  start !== null || end !== null;

export const toJstTimestamp = (workDate: string, minutes: number | null) => {
  if (minutes === null) return null;
  const [year, month, day] = workDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Math.floor(minutes / 1440)));
  const minuteOfDay = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const mm = String(minuteOfDay % 60).padStart(2, "0");
  return `${dateToYmd(date)}T${hh}:${mm}:00+09:00`;
};

export const parseAttendanceWorkbook = (
  buffer: ArrayBuffer,
  preferredSheetName?: string | null,
): ParsedAttendanceWorkbook => {
  const files = unzipSync(new Uint8Array(buffer));
  const sheetPaths = getWorkbookSheetPaths(files);
  const sheetName =
    (preferredSheetName === "20日締" || preferredSheetName === "末日締"
      ? preferredSheetName
      : null) ??
    (sheetPaths.has("末日締") ? "末日締" : null) ??
    (sheetPaths.has("20日締") ? "20日締" : null);

  if (!sheetName) {
    throw new Error("出勤簿テンプレートのシート（末日締 または 20日締）が見つかりません。");
  }

  const sheetPath = sheetPaths.get(sheetName);
  if (!sheetPath || !files[sheetPath]) {
    throw new Error(`${sheetName} シートを読み込めませんでした。`);
  }
  const sharedStrings = parseSharedStrings(
    files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : null,
  );
  const sheet = parseSheet(strFromU8(files[sheetPath]), sharedStrings);

  const year = cellNumber(sheet, "A1");
  const month = cellNumber(sheet, "D1");
  if (!year || !month) {
    throw new Error("A1の年、D1の月を読み取れませんでした。");
  }

  const employeeCode = cellText(sheet, "D3") || `EXCEL-${sheetName}-${year}${String(month).padStart(2, "0")}`;
  const fullName = cellText(sheet, "J3") || "出勤簿インポート";
  const department = cellText(sheet, "AA3") || null;
  const periodDates = getPeriodDates(sheetName, year, month);
  const calendarDays = daysBetweenInclusive(periodDates.start, periodDates.end);
  const days: AttendanceWorkbookDay[] = [];
  const importNotes: string[] = [];

  if (cellText(sheet, "D3") === "") {
    importNotes.push("社員IDが空のため、自動コードで取り込みました。次回からD3に社員IDを入力してください。");
  }

  for (let offset = 0; offset < Math.min(MAX_WORK_DAYS, calendarDays); offset += 1) {
    const row = DEFAULT_WORK_START_ROW + offset;
    const workDate = dateToYmd(addDays(periodDates.start, offset));
    const dayType = cellText(sheet, `E${row}`);
    const plannedStartMinutes = cellMinutes(sheet, `O${row}`);
    const plannedEndMinutes = cellMinutes(sheet, `R${row}`);
    const plannedBreakMinutes = positiveMinutes(cellMinutes(sheet, `U${row}`));
    const actualStartMinutes = cellMinutes(sheet, `I${row}`);
    const actualEndMinutes = cellMinutes(sheet, `L${row}`);
    const additionalBreakMinutes = cellMinutes(sheet, `AL${row}`) ?? 0;
    const cachedTotalMinutes = cellMinutes(sheet, `AN${row}`);
    const computedPlannedMinutes = Math.max(
      0,
      diffClockMinutes(plannedStartMinutes, plannedEndMinutes) - plannedBreakMinutes,
    );
    const actualBreakMinutes = Math.max(0, plannedBreakMinutes + additionalBreakMinutes);
    const computedActualMinutes = Math.max(
      0,
      diffClockMinutes(actualStartMinutes, actualEndMinutes) - actualBreakMinutes,
    );
    const actualWorkMinutes =
      shouldCreateAttendanceLog(actualStartMinutes, actualEndMinutes) || cachedTotalMinutes === null
        ? computedActualMinutes
        : Math.max(0, cachedTotalMinutes);

    if (!shouldCreateShift(dayType, computedPlannedMinutes) && !shouldCreateAttendanceLog(actualStartMinutes, actualEndMinutes)) {
      continue;
    }

    days.push({
      workDate,
      dayType,
      plannedStartMinutes,
      plannedEndMinutes,
      plannedBreakMinutes,
      plannedWorkMinutes: computedPlannedMinutes,
      actualStartMinutes,
      actualEndMinutes,
      actualBreakMinutes,
      actualWorkMinutes,
    });
  }

  return {
    sheetName,
    year,
    month,
    employeeCode,
    fullName,
    department,
    period: {
      label: `${year}年${month}月度${sheetName}`,
      startDate: dateToYmd(periodDates.start),
      endDate: dateToYmd(periodDates.end),
      baseDate: dateToYmd(periodDates.base),
      calendarDays,
    },
    days,
    importNotes,
  };
};

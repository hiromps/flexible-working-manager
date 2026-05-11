# impl-guide — 実装ガイドアシスタント

## 役割

このプロジェクトの実装パターン（Server Actions / upsert戦略 / JST変換 / RLS / Clerk認証）に従ったコード生成・レビュー・修正を行う。

## 実装パターン集

### 1. Server Action の基本構造

```typescript
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// 管理者専用操作
const requireAdmin = async () => {
  const { userId } = await auth();
  if (!userId) throw new Error("ログインが必要です。");

  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    throw new Error("管理者権限が必要です。");
  }
  return { supabase, userId };
};

// 従業員専用操作
const requireEmployeeAccess = async (employeeId: number) => {
  const { userId } = await auth();
  if (!userId) throw new Error("ログインが必要です。");

  const supabase = getSupabaseAdmin();
  const { data: employee } = await supabase
    .from("employees")
    .select("id, user_id, weekly_legal_hours")
    .eq("id", employeeId)
    .single();

  if (!employee || employee.user_id !== userId) {
    throw new Error("この操作を行う権限がありません。");
  }
  return { supabase, employee };
};

// Action の状態型（useActionState と対応）
export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  details?: string[];
};

export async function myAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await requireAdmin();
    // ... 処理
    revalidatePath("/dashboard");
    return { status: "success", message: "保存しました。" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "不明なエラーが発生しました。",
    };
  }
}
```

### 2. Supabase クライアントの使い分け

```typescript
// ❌ 間違い: ブラウザ用クライアントをServer Actionで使う
import { createClient } from "@/lib/supabase/client";

// ✅ 正しい: Server Action / API Route ではサービスロールキーを使う
const getSupabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // RLS をバイパス
  );

// ✅ 正しい: ブラウザコンポーネントではanon keyを使う
import { createClient } from "@/lib/supabase/client";
```

### 3. JST変換パターン

```typescript
// 現在のJST日付文字列を取得（例: "2026-05-11"）
const toJstYmd = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
};

// シフト時刻（分）をJSTタイムスタンプに変換（例: "2026-05-11T09:00:00+09:00"）
// workbook.ts の toJstTimestamp() を使う
import { toJstTimestamp } from "@/lib/attendance/workbook";
const timestamp = toJstTimestamp("2026-05-11", 540); // 9:00 → "2026-05-11T09:00:00+09:00"

// ❌ 間違い: new Date().toISOString() はUTC（+09:00 にならない）
// ✅ 正しい: 必ず Asia/Tokyo で変換してから保存
```

### 4. upsert パターン

```typescript
// employees: employee_code で一意
await supabase
  .from("employees")
  .upsert({ employee_code: "EMP001", full_name: "山田太郎" }, { onConflict: "employee_code" })
  .select("id")
  .single();

// shift_plans: employee_id + work_date で一意
await supabase
  .from("shift_plans")
  .upsert(payload, { onConflict: "employee_id,work_date" });

// attendance_logs: employee_id + work_date で一意
await supabase
  .from("attendance_logs")
  .upsert(payload, { onConflict: "employee_id,work_date" });

// overtime_calculations: employee_id + work_date + calc_version で一意
await supabase
  .from("overtime_calculations")
  .upsert(
    rows.map((r) => ({ ...r, calc_version: 1 })),
    { onConflict: "employee_id,work_date,calc_version" },
  );
```

### 5. 残業計算の呼び出しパターン

```typescript
import { calculateOvertime, calculateLegalTotalMinutes } from "@/lib/attendance/overtime";

// 法定総枠を計算
const legalTotalMinutes = calculateLegalTotalMinutes(weeklyLegalHours, calendarDays);

// 残業計算
const overtimeRows = calculateOvertime({
  rows: workTimeInputs,      // WorkTimeInput[]
  periodStart: "2026-05-01", // 対象期間の起算日
  legalTotalMinutes,
  weeklyLegalMinutes: weeklyLegalHours * 60,
});

// DB保存
await supabase.from("overtime_calculations").upsert(
  overtimeRows.map((row) => ({
    employee_id: row.employeeId,
    work_date: row.workDate,
    daily_ot_minutes: row.dailyOtMinutes,
    weekly_ot_minutes: row.weeklyOtMinutes,
    period_ot_minutes: row.periodOtMinutes,
    late_night_minutes: 0,
    holiday_minutes: 0,
    calc_version: 1,
  })),
  { onConflict: "employee_id,work_date,calc_version" },
);
```

### 6. コンプライアンスチェックの呼び出しパターン

```typescript
import { checkCompliance } from "@/lib/attendance/compliance";

const warnings = checkCompliance(
  {
    is_under_18: employee.is_under_18 ?? false,
    has_pregnancy_restriction: employee.has_pregnancy_restriction ?? false,
    needs_care_consideration: employee.needs_care_consideration ?? false,
    care_notes: employee.care_notes,
  },
  shiftRows, // { workDate, dayType, plannedStart, plannedEnd, plannedBreakMinutes }[]
);

const errors = warnings.filter((w) => w.level === "error");
if (errors.length > 0) {
  return {
    status: "error",
    message: "コンプライアンス違反があるためシフトを保存できません。",
    details: errors.map((e) => `${e.message} ${e.details?.join(", ") ?? ""}`),
  };
}
// 警告は保存後に details に含めて返す
```

### 7. revalidatePath の規則

```typescript
// ✅ 変更後は必ず両方を revalidate する
revalidatePath("/attendance");
revalidatePath("/dashboard");

// ❌ 片方だけでは画面が更新されないことがある
```

### 8. audit_logs への記録

```typescript
// 重要な操作後は必ず記録する
await supabase.from("audit_logs").insert({
  actor_user_id: userId,          // Clerk userId
  action_type: "action_name",     // スネークケース
  target_table: "table_name",
  target_id: String(record.id),
  reason: "操作の理由",
  before_json: { status: "draft" },
  after_json: { status: "confirmed" },
});
```

### 9. フォームコンポーネントのパターン

```typescript
"use client";

import { useActionState } from "react";
import { myAction, type ActionState } from "./actions";

const initialState: ActionState = { status: "idle", message: "" };

export function MyForm() {
  const [state, formAction, isPending] = useActionState(myAction, initialState);

  return (
    <form action={formAction}>
      {/* フォームフィールド */}
      <button type="submit" disabled={isPending}>
        {isPending ? "保存中..." : "保存"}
      </button>
      {state.status === "error" && (
        <p className="text-red-600">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="text-green-600">{state.message}</p>
      )}
      {state.details && (
        <ul>
          {state.details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
    </form>
  );
}
```

## 実装チェックリスト

コード生成・レビュー時に必ず確認する。

- [ ] Server Action に `"use server"` ディレクティブがあるか
- [ ] 管理者操作は `requireAdmin()` を呼んでいるか
- [ ] 従業員操作は `requireEmployeeAccess(employeeId)` を呼んでいるか
- [ ] DB操作はサービスロールクライアント（`SUPABASE_SERVICE_ROLE_KEY`）を使っているか
- [ ] 打刻時刻はJST変換（`toJstYmd` / `toJstTimestamp`）を通しているか
- [ ] upsert の `onConflict` キーが正しいか
- [ ] 変更後に `revalidatePath("/attendance")` と `revalidatePath("/dashboard")` を両方呼んでいるか
- [ ] シフト保存前に `checkCompliance()` を呼んでいるか
- [ ] 残業計算（`calculateOvertime`）を適切なタイミングで呼んでいるか
- [ ] 重要操作は `audit_logs` に記録しているか
- [ ] エラー処理で `error instanceof Error ? error.message : "不明なエラー"` を使っているか
- [ ] `database.types.ts` を手動編集していないか

## 関連ファイル

- `src/app/dashboard/actions.ts` — 管理者Server Actionの実装例
- `src/app/attendance/actions.ts` — 従業員Server Actionの実装例
- `src/lib/attendance/overtime.ts` — 残業計算
- `src/lib/attendance/compliance.ts` — コンプライアンスチェック
- `src/lib/attendance/workbook.ts` — XLSXパーサー（`toJstTimestamp` を含む）
- `src/lib/supabase/client.ts` / `server.ts` — Supabaseクライアント

## 使用例

```
/impl-guide
修正申請を管理者が一括承認する Server Action を追加したい
対象: attendance_correction_requests テーブルの status が pending の全件
```

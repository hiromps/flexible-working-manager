@AGENTS.md

# Flexible Working Manager — CLAUDE.md

## プロジェクト概要

**MINORU Attendance** — 労働基準法第32条の2「1か月単位の変形労働時間制」に準拠した日本向け勤怠管理システム。

- 対象制度: 1か月以内の期間を平均して週40h（特例事業場は44h）以内に収まるよう労働日・労働時間を設定する変形労働時間制
- 締め規則: **末日締**（当月1日〜末日）と **20日締**（前月21日〜当月20日）の2種類
- 割増賃金判定: **日次・週次・期間の3段階**（厚生労働省リーフレット準拠）
- 詳細仕様: `requirement.md` / アーキテクチャ: `Architecture.md`

---

## 技術スタック

| 分類 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | Next.js (App Router) | 16.2.3 |
| UI | React | 19.2.4 |
| 認証 | Clerk (`@clerk/nextjs`) | 7.2.1 |
| DB | Supabase (PostgreSQL + RLS) | `@supabase/ssr` 0.10.2 |
| スタイル | Tailwind CSS | v4 |
| アイコン | lucide-react | 1.8.0 |
| XLSXパース | fflate | 0.8.2 |
| Webhook検証 | svix | 1.90.0 |
| 言語 | TypeScript (strict mode) | 5 |
| パッケージ管理 | pnpm | — |
| デプロイ | Vercel | — |

パスエイリアス: `@/*` → `./src/*`

---

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                        # ランディングページ
│   ├── layout.tsx                      # ClerkProvider ラップ
│   ├── globals.css
│   ├── sign-in/ sign-up/ login/        # Clerk 認証ページ
│   ├── api/webhooks/clerk/route.ts     # user.created → profiles/employees 作成
│   ├── auth/callback/ signout/         # Supabase コールバック / サインアウト
│   ├── onboarding/
│   │   ├── page.tsx
│   │   ├── onboarding-form.tsx         # クライアントコンポーネント
│   │   └── actions.ts                  # Server Action
│   ├── attendance/
│   │   ├── page.tsx                    # 打刻UI（従業員）
│   │   ├── clock.tsx
│   │   ├── correction-modal.tsx        # 修正申請モーダル
│   │   └── actions.ts                  # clockIn/Out, startBreak, endBreak, submitCorrectionRequest
│   └── dashboard/
│       ├── page.tsx                    # 管理者ダッシュボード
│       ├── actions.ts                  # importAttendanceWorkbook, saveEmbeddedShiftWorkbook,
│       │                               # recalculateLatestPeriod, approveCorrection, rejectCorrection,
│       │                               # confirmLatestPeriodShifts
│       ├── correction-list.tsx
│       ├── embedded-shift-workbook.tsx
│       ├── import-form.tsx
│       └── payroll-export/route.ts
└── lib/
    ├── attendance/
    │   ├── workbook.ts    # XLSXパーサー（fflate展開 → XML解析）
    │   ├── overtime.ts    # 3段階残業計算
    │   └── compliance.ts  # 年少者・妊産婦・育児介護チェック
    └── supabase/
        ├── client.ts      # ブラウザ用
        └── server.ts      # サーバー用（cookie付き）

docs/
├── 出勤簿.xlsx            # 出勤簿テンプレート（末日締・20日締の2シート）
└── 1ヶ月単位の変形労働時間制.pdf  # 厚生労働省リーフレット（法的根拠）
```

---

## DBスキーマ

| テーブル | 主な用途 | 一意制約 |
|---------|---------|---------|
| `profiles` | Clerk userId ↔ role (admin/manager/employee) | `id` (Clerk userId) |
| `employees` | 社員マスタ（氏名・部署・週法定時間・コンプライアンスフラグ） | `employee_code` |
| `monthly_periods` | 対象期間・法定総枠・締め規則・status | `start_date + end_date` |
| `shift_plans` | 予定シフト（planned_start/end/break/work_minutes, status） | `employee_id + work_date` |
| `attendance_logs` | 実績打刻（actual_start/end/break/work_minutes, current_break_start） | `employee_id + work_date` |
| `overtime_calculations` | 3段階残業計算結果（daily/weekly/period_ot_minutes） | `employee_id + work_date + calc_version` |
| `attendance_correction_requests` | 修正申請（requested_start/end/break_minutes, status, reason） | — |
| `audit_logs` | 変更履歴（actor_user_id, action_type, before_json, after_json） | — |

**ステータス遷移**:
- `monthly_periods.status`: `draft` → `confirmed` → `closed`
- `shift_plans.status`: `draft` → `confirmed`
- `attendance_correction_requests.status`: `pending` → `approved` / `rejected`

---

## 残業計算ロジック（最重要）

厚生労働省リーフレット（`docs/1ヶ月単位の変形労働時間制.pdf`）に基づく3段階判定。

```
法定総枠（分） = round(週法定時間(分) × 暦日数 ÷ 7)
  例: 40h × 60 × 31日 ÷ 7 = 10,628分 ≈ 177.1h

① 日次OT  = max(0, 実労働 - max(所定時間, 480分))
② 週次OT  = max(0, 週実労働 - max(週所定合計, 週法定時間) - 週内①合計)
             ※ 7日未満の端数週は計算しない（③へ）
             ※ 週の最終日レコードに計上
③ 期間OT  = max(0, 期間実労働合計 - 法定総枠 - ①合計 - ②合計)
             ※ 期間最終日レコードに計上
```

実装: `src/lib/attendance/overtime.ts` の `calculateOvertime()`

---

## 出勤簿Excelのセルマッピング

| セル | 内容 |
|------|------|
| A1 | 年 |
| D1 | 月 |
| D3 | 社員番号（空の場合は自動コード生成） |
| J3 | 氏名 |
| AA3 | 部署 |
| E列（13行〜） | 勤務区分（出勤/休日/休業(時間)等） |
| I列（13行〜） | 実績出勤時刻 |
| L列（13行〜） | 実績退勤時刻 |
| O列（13行〜） | 予定出勤時刻 |
| R列（13行〜） | 予定退勤時刻 |
| U列（13行〜） | 予定休憩時間（分） |
| AL列（13行〜） | 追加休憩時間（分） |
| AN列（13行〜） | キャッシュ済み実績時間 |

- **末日締シート**: 当月1日〜月末日（最大31行）
- **20日締シート**: 前月21日〜当月20日（最大31行）

---

## 実装パターン・注意事項

### Server Actions
- 全変更操作は `"use server"` のServer Actionで実装
- フォームは `useActionState` を使用
- 状態型: `{ status: "idle" | "success" | "error", message: string, details?: string[] }`

### 認証・認可
- `requireAdmin()`: Clerk userId → `profiles.role` が admin/manager を確認
- `requireEmployeeAccess(employeeId)`: `employees.user_id` と Clerk userId の一致を確認
- 管理者操作は必ず `SUPABASE_SERVICE_ROLE_KEY` を使うサービスロールクライアントで行う

### JST変換
- 打刻時刻は `Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo" })` でJST日付を取得
- DB保存形式: `YYYY-MM-DDTHH:MM:SS+09:00`
- `toJstTimestamp(workDate, minutes)` でシフト時刻を変換

### upsert戦略
- `employees`: `onConflict: "employee_code"`
- `shift_plans`: `onConflict: "employee_id,work_date"`
- `attendance_logs`: `onConflict: "employee_id,work_date"`
- `overtime_calculations`: `onConflict: "employee_id,work_date,calc_version"`

### revalidatePath
- 変更後は必ず `/attendance` と `/dashboard` の両方を `revalidatePath` する

### 文字化け対策
- `normalizeDayType()`: 全角括弧・空白・Shift-JIS由来文字列を正規化
- `normalizeClosingRule()`: 文字化けした「20日締」も正規化して判定
- `isWorkDayType()`: 「出勤」と文字化けした同義文字列の両方を受け入れる

### 型
- `src/types/database.types.ts` はSupabaseから自動生成 — **手動編集禁止**
- `calc_version` は現在 `1` 固定

### コンプライアンスチェック呼び出しタイミング
- `saveEmbeddedShiftWorkbook()` 内でシフト保存前に `checkCompliance()` を呼ぶ
- エラーがあれば保存をブロックして返す
- 警告（育児介護等）は保存後に `details` に含めて返す

---

## 環境変数

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 開発コマンド

```bash
pnpm dev      # 開発サーバー (localhost:3000)
pnpm build    # プロダクションビルド
pnpm lint     # ESLint
```

---

## 参照ドキュメント

| ファイル | 内容 |
|---------|------|
| `requirement.md` | 機能要件・非機能要件（法的根拠込み） |
| `Architecture.md` | システム構成・データフロー・Mermaid図 |
| `docs/1ヶ月単位の変形労働時間制.pdf` | 厚生労働省リーフレット（制度の法的根拠） |
| `docs/出勤簿.xlsx` | 出勤簿テンプレート（末日締・20日締の2シート） |

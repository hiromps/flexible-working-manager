# db-migration — DB操作・マイグレーションアシスタント

## 役割

Supabase（PostgreSQL）のスキーマ変更・マイグレーションファイル作成・RLS設定を、このプロジェクトの規約に従って安全に行う。

## 実行手順

### Step 1: 変更内容の確認

ユーザーの要求を以下の観点で整理する。

- 変更の種類（テーブル追加 / カラム追加 / RLS変更 / インデックス追加 / データ修正）
- 既存データへの影響（NULL制約・デフォルト値・既存行の扱い）
- ロールバック方法

**必ず既存スキーマを確認してから作業する。**

```bash
# 既存マイグレーションの確認
ls supabase/migrations/
```

### Step 2: マイグレーションファイルの命名規則

```
supabase/migrations/YYYYMMDDHHMMSS_[説明].sql
例: supabase/migrations/20260512000000_add_hourly_wage_to_employees.sql
```

- タイムスタンプは `YYYYMMDDHHMMSS` 形式（JST基準）
- 説明はスネークケース、英語で簡潔に
- 1ファイル = 1変更単位（複数の無関係な変更を混在させない）

### Step 3: マイグレーションSQLの作成規則

**カラム追加の基本パターン**
```sql
-- 既存テーブルへのカラム追加は必ずデフォルト値付きで
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_wage INTEGER DEFAULT 0;

-- NOT NULL かつデフォルトなしの場合は2ステップで
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_wage INTEGER;
UPDATE employees SET hourly_wage = 0 WHERE hourly_wage IS NULL;
ALTER TABLE employees ALTER COLUMN hourly_wage SET NOT NULL;
```

**テーブル追加の基本パターン**
```sql
CREATE TABLE IF NOT EXISTS [table_name] (
  id BIGSERIAL PRIMARY KEY,
  -- 外部キーは必ず ON DELETE CASCADE または RESTRICT を明示
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS は必ず有効化
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
```

**インデックスの追加**
```sql
-- work_date での範囲検索が多いテーブルには必ず追加
CREATE INDEX IF NOT EXISTS idx_[table]_[column] ON [table_name]([column]);
-- 複合インデックス
CREATE INDEX IF NOT EXISTS idx_[table]_emp_date ON [table_name](employee_id, work_date);
```

### Step 4: RLS設定の規則

このプロジェクトのRLSパターン:

**従業員が自分のデータのみ参照・操作できるパターン**
```sql
-- 読み取り: 自分の employee_id に紐づくデータのみ
CREATE POLICY "[table]_select_own" ON [table_name]
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- 挿入: 自分の employee_id のみ
CREATE POLICY "[table]_insert_own" ON [table_name]
  FOR INSERT WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );
```

**管理者はサービスロールキーで RLS をバイパスするため、管理者用ポリシーは不要。**

**profiles テーブルのパターン（自分のプロフィールのみ）**
```sql
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());
```

### Step 5: 既存テーブル一覧と主キー

変更前に必ず確認する既存テーブル:

| テーブル | 主キー | 重要な一意制約 |
|---------|--------|--------------|
| `profiles` | `id` (text, Clerk userId) | — |
| `employees` | `id` (bigserial) | `employee_code` |
| `monthly_periods` | `id` (bigserial) | `(start_date, end_date)` |
| `shift_plans` | `id` (bigserial) | `(employee_id, work_date)` |
| `attendance_logs` | `id` (bigserial) | `(employee_id, work_date)` |
| `overtime_calculations` | `id` (bigserial) | `(employee_id, work_date, calc_version)` |
| `attendance_correction_requests` | `id` (bigserial) | — |
| `audit_logs` | `id` (bigserial) | — |

### Step 6: `database.types.ts` の更新案内

スキーマ変更後は自動生成ファイルの再生成が必要であることをユーザーに伝える。

```bash
# Supabase CLI でローカルの型を再生成
npx supabase gen types typescript --project-id [project-id] > src/types/database.types.ts
```

`src/types/database.types.ts` は手動編集禁止。

### Step 7: チェックリスト

マイグレーション作成後に必ず確認する。

- [ ] `IF NOT EXISTS` / `IF EXISTS` で冪等性を保証しているか
- [ ] 既存データへの影響を考慮したデフォルト値が設定されているか
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` を忘れていないか
- [ ] 外部キーに `ON DELETE` アクションを明示しているか
- [ ] 検索頻度の高いカラムにインデックスを追加しているか
- [ ] ファイル名のタイムスタンプが既存ファイルと重複していないか
- [ ] `database.types.ts` の再生成をユーザーに案内したか

## 出力フォーマット

```sql
-- migration: supabase/migrations/YYYYMMDDHHMMSS_[説明].sql
-- 変更内容: [変更の概要]
-- 影響テーブル: [テーブル名]
-- ロールバック: [ロールバック方法]

[SQL本文]
```

## 関連ファイル

- `supabase/migrations/` — 既存マイグレーション履歴
- `src/types/database.types.ts` — 自動生成型定義（手動編集禁止）
- `Architecture.md` — テーブル一覧とスキーマ概要
- `requirement.md` — REQ-001〜REQ-010

## 使用例

```
/db-migration
employees テーブルに時給（hourly_wage, INTEGER）カラムを追加したい
既存の社員データには 0 をデフォルトで設定する
```

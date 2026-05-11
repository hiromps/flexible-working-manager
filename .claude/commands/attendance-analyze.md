# attendance-analyze — 勤怠データ分析アシスタント

## 役割

`attendance_logs`・`overtime_calculations`・`shift_plans` のデータを分析し、実績サマリー・異常値・残業傾向を報告する。

## 実行手順

### Step 1: 分析対象の特定

ユーザーの入力から以下を特定する。

- 分析対象（全社員 / 特定社員）
- 対象期間 or `monthly_periods` の ID
- 分析の目的（サマリー / 異常検出 / 給与計算確認 / 月次レポート）

### Step 2: データ取得クエリの提示

Supabase の管理クライアント（`SUPABASE_SERVICE_ROLE_KEY`）を使う前提で、以下のクエリ例を提示する。

**実績サマリー**
```sql
SELECT
  e.full_name,
  e.employee_code,
  e.department,
  mp.label AS period_label,
  mp.legal_total_minutes,
  SUM(al.actual_work_minutes) AS total_actual_minutes,
  SUM(al.actual_break_minutes) AS total_break_minutes,
  COUNT(*) FILTER (WHERE al.actual_start IS NOT NULL) AS work_days
FROM employees e
JOIN shift_plans sp ON sp.employee_id = e.id
JOIN monthly_periods mp ON mp.id = sp.monthly_period_id
LEFT JOIN attendance_logs al ON al.employee_id = e.id AND al.work_date = sp.work_date
WHERE mp.id = [period_id]
GROUP BY e.id, e.full_name, e.employee_code, e.department, mp.label, mp.legal_total_minutes
ORDER BY e.employee_code;
```

**残業サマリー**
```sql
SELECT
  e.full_name,
  e.employee_code,
  SUM(oc.daily_ot_minutes) AS total_daily_ot,
  SUM(oc.weekly_ot_minutes) AS total_weekly_ot,
  SUM(oc.period_ot_minutes) AS total_period_ot,
  SUM(oc.daily_ot_minutes + oc.weekly_ot_minutes + oc.period_ot_minutes) AS total_ot_minutes
FROM overtime_calculations oc
JOIN employees e ON e.id = oc.employee_id
JOIN shift_plans sp ON sp.employee_id = oc.employee_id AND sp.work_date = oc.work_date
JOIN monthly_periods mp ON mp.id = sp.monthly_period_id
WHERE mp.id = [period_id] AND oc.calc_version = 1
GROUP BY e.id, e.full_name, e.employee_code
ORDER BY total_ot_minutes DESC;
```

**打刻漏れ検出（シフトあり・打刻なし）**
```sql
SELECT
  e.full_name,
  sp.work_date,
  sp.planned_work_minutes
FROM shift_plans sp
JOIN employees e ON e.id = sp.employee_id
LEFT JOIN attendance_logs al ON al.employee_id = sp.employee_id AND al.work_date = sp.work_date
WHERE sp.monthly_period_id = [period_id]
  AND sp.status = 'confirmed'
  AND al.id IS NULL
ORDER BY sp.work_date, e.full_name;
```

**休憩中断残り（退勤未打刻の検出）**
```sql
SELECT
  e.full_name,
  al.work_date,
  al.actual_start,
  al.current_break_start
FROM attendance_logs al
JOIN employees e ON e.id = al.employee_id
WHERE al.actual_end IS NULL
  AND al.actual_start IS NOT NULL
ORDER BY al.work_date DESC;
```

### Step 3: 分析・レポート出力

取得したデータをもとに以下を分析する。

**サマリー分析**
- 社員ごとの実労働時間 vs 法定総枠の比較
- 法定総枠超過率（`total_actual_minutes / legal_total_minutes × 100`）
- 出勤日数 vs 計画シフト日数

**異常値検出**
- 法定総枠を超過している社員（期間OT発生）
- シフトはあるが打刻がない日（打刻漏れ）
- 退勤打刻のない日（`actual_end IS NULL AND actual_start IS NOT NULL`）
- 休憩中のまま終わっている日（`current_break_start IS NOT NULL AND actual_end IS NULL`）
- 実績 > シフトの乖離が大きい日（30分超）

**残業傾向**
- 日次OT / 週次OT / 期間OTの内訳
- 最も残業が多い社員・日付
- 週別の労働時間推移

### Step 4: 推奨アクション

分析結果に応じて以下を提案する。

| 検出内容 | 推奨アクション |
|---------|--------------|
| 打刻漏れ | 従業員に確認し、修正申請（`submitCorrectionRequest`）を促す |
| 退勤未打刻 | 管理者が `approveCorrection` で実績を補完する |
| 法定総枠超過 | 次期シフトで休日数を増やすか勤務時間を短縮する |
| 残業過多社員 | シフト作成時に `/shift-validate` で事前検証を実施する |

## 出力フォーマット例

```
## 勤怠分析レポート: [期間ラベル]

### 全社サマリー
| 氏名 | 実労働(h) | 法定総枠(h) | 超過率 | 出勤日数 | 残業合計(h) |
|------|----------|-----------|-------|---------|-----------|
| 山田太郎 | 182.3 | 177.1 | +3.0% | 22 | 5.2 |

### 異常値アラート
🚨 打刻漏れ: X名・X件
⚠️ 退勤未打刻: X名
⚠️ 法定総枠超過: X名

### 残業内訳（全社合計）
- 日次OT: X.Xh
- 週次OT: X.Xh
- 期間OT: X.Xh

### 要対応アクション
[具体的な対応指示]
```

## 関連ファイル

- `src/app/dashboard/actions.ts` — `getAttendanceLogs`, `recalculateLatestPeriod`
- `src/lib/attendance/overtime.ts` — 残業計算ロジック
- `requirement.md` — REQ-009, REQ-010

## 使用例

```
/attendance-analyze
2026年5月度・末日締の全社員サマリーを出して、異常値も含めて
```

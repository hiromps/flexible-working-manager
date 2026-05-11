-- Add unique constraint to monthly_periods for safe upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monthly_periods_start_end_unique'
  ) THEN
    ALTER TABLE monthly_periods ADD CONSTRAINT monthly_periods_start_end_unique UNIQUE (start_date, end_date);
  END IF;
END
$$;

-- Performance indexes for date-range queries
CREATE INDEX IF NOT EXISTS idx_attendance_logs_work_date ON attendance_logs(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_emp_date ON attendance_logs(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shift_plans_work_date ON shift_plans(work_date);
CREATE INDEX IF NOT EXISTS idx_shift_plans_emp_date ON shift_plans(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shift_plans_period ON shift_plans(monthly_period_id);
CREATE INDEX IF NOT EXISTS idx_overtime_emp_date ON overtime_calculations(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_correction_requests_emp ON attendance_correction_requests(employee_id, status);

alter table public.attendance_logs
add column if not exists current_break_start timestamptz;

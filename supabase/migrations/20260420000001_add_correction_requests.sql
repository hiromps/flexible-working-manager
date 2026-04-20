create table public.attendance_correction_requests (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  work_date date not null,
  target_log_id bigint references public.attendance_logs(id) on delete set null,
  requested_start timestamptz,
  requested_end timestamptz,
  requested_break_minutes int not null default 0,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance_correction_requests enable row level security;

create policy "employees can view own requests"
on public.attendance_correction_requests
for select
to authenticated
using (
  employee_id in (
    select e.id from public.employees e
    where e.user_id = auth.uid()
  )
);

create policy "employees can insert own requests"
on public.attendance_correction_requests
for insert
to authenticated
with check (
  employee_id in (
    select e.id from public.employees e
    where e.user_id = auth.uid()
  )
);

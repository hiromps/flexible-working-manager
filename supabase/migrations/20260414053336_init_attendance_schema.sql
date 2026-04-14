create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null check (role in ('admin', 'manager', 'employee')),
  created_at timestamptz not null default now()
);

create table public.employees (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  employee_code text unique not null,
  full_name text not null,
  department text,
  weekly_legal_hours int not null default 40 check (weekly_legal_hours in (40,44)),
  is_variable_monthly boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.monthly_periods (
  id bigint generated always as identity primary key,
  label text not null,
  start_date date not null,
  end_date date not null,
  base_date date not null,
  legal_total_minutes int not null,
  status text not null default 'draft' check (status in ('draft','confirmed','closed')),
  created_at timestamptz not null default now()
);

create table public.shift_plans (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  monthly_period_id bigint not null references public.monthly_periods(id) on delete cascade,
  work_date date not null,
  planned_start timestamptz,
  planned_end timestamptz,
  planned_break_minutes int not null default 0,
  planned_work_minutes int not null default 0,
  status text not null default 'draft' check (status in ('draft','confirmed')),
  created_at timestamptz not null default now(),
  unique(employee_id, work_date)
);

create table public.attendance_logs (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  work_date date not null,
  actual_start timestamptz,
  actual_end timestamptz,
  actual_break_minutes int not null default 0,
  actual_work_minutes int not null default 0,
  source_type text not null default 'web' check (source_type in ('web','mobile','admin','import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, work_date)
);

create table public.overtime_calculations (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  work_date date not null,
  daily_ot_minutes int not null default 0,
  weekly_ot_minutes int not null default 0,
  period_ot_minutes int not null default 0,
  late_night_minutes int not null default 0,
  holiday_minutes int not null default 0,
  calc_version int not null default 1,
  created_at timestamptz not null default now(),
  unique(employee_id, work_date, calc_version)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  target_table text not null,
  target_id text not null,
  before_json jsonb,
  after_json jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.monthly_periods enable row level security;
alter table public.shift_plans enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.overtime_calculations enable row level security;
alter table public.audit_logs enable row level security;

create policy "users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "employees can view own attendance"
on public.attendance_logs
for select
to authenticated
using (
  employee_id in (
    select e.id from public.employees e
    where e.user_id = auth.uid()
  )
);

create policy "employees can insert own attendance"
on public.attendance_logs
for insert
to authenticated
with check (
  employee_id in (
    select e.id from public.employees e
    where e.user_id = auth.uid()
  )
);

alter table public.employees 
  add column is_under_18 boolean not null default false,
  add column has_pregnancy_restriction boolean not null default false,
  add column needs_care_consideration boolean not null default false,
  add column care_notes text;

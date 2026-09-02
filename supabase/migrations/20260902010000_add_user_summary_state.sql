create table if not exists public.user_summary_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sex text,
  birth_month integer check (birth_month is null or birth_month between 0 and 11),
  birth_year integer check (birth_year is null or birth_year between 1900 and 2100),
  cycle_day integer not null default 1 check (cycle_day between 1 and 365),
  cycle_length integer not null default 28 check (cycle_length between 1 and 365),
  period_length integer not null default 5 check (period_length between 1 and 90),
  sleep_hours numeric not null default 7.4 check (sleep_hours between 0 and 24),
  resting_hr integer not null default 54 check (resting_hr between 20 and 250),
  soreness text not null default 'Low' check (soreness in ('Low', 'Moderate', 'High')),
  stretch_done boolean not null default false,
  core_today jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_summary_state enable row level security;

drop policy if exists "Users can read their Summary state" on public.user_summary_state;
create policy "Users can read their Summary state"
  on public.user_summary_state for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their Summary state" on public.user_summary_state;
create policy "Users can insert their Summary state"
  on public.user_summary_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their Summary state" on public.user_summary_state;
create policy "Users can update their Summary state"
  on public.user_summary_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

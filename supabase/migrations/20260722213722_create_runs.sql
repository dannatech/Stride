-- Persists completed Live-tab runs per user so history, streaks, VO2max
-- trend, training-load (ACWR), and achievements can be computed from real
-- data instead of static in-memory arrays.

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  distance_mi double precision not null,
  duration_sec integer not null,
  avg_pace_sec integer not null,
  sprints integer not null default 0,
  avg_hr integer,
  avg_cadence integer,
  rpe integer,
  vo2max double precision,
  pace_minutes integer[] not null default '{}',
  sprint_minutes integer[] not null default '{}'
);

create index if not exists runs_user_id_created_at_idx
  on public.runs (user_id, created_at desc);

alter table public.runs enable row level security;

create policy "Users can view their own runs"
  on public.runs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own runs"
  on public.runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own runs"
  on public.runs for delete
  using (auth.uid() = user_id);

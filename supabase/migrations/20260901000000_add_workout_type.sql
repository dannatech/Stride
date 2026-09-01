-- Distinguishes Run / Walk / Sprint sessions so trend analysis (pace,
-- VO2max, streaks) can be scoped to one type instead of mixing, say, a
-- 15:00/mi walk into a running pace trend.
alter table public.runs
  add column workout_type text not null default 'run'
    check (workout_type in ('run', 'walk', 'sprint'));

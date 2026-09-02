-- Persists Apple Watch running-dynamics and power summaries for each run.
-- Values remain nullable because simulators, older Watch models, and short
-- workouts may not produce every HealthKit running metric.

alter table public.runs
  add column if not exists avg_ground_contact_time_ms double precision,
  add column if not exists avg_vertical_oscillation_cm double precision,
  add column if not exists avg_stride_length_m double precision,
  add column if not exists avg_running_power_watts double precision;

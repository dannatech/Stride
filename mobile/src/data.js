import { T } from "./theme";

/* ───────── run history — persisted to Supabase, derived client-side (see below) ───────── */

export const SPRINT_GOAL = 10;
export const TODAY_IDX = new Date().getDay(); // 0=Sun..6=Sat
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/* ───────── workout types — picked before starting a Live session ───────── */

// Each type's goalPaceSecPerMile/warmupSeconds are just the defaults applied
// when switching to that type; the user can still fine-tune both afterward.
export const WORKOUT_TYPES = {
  run: { label: "Run", verb: "Run", goalPaceSecPerMile: 480, warmupSeconds: 300 }, // 8:00/mi, 5 min warm-up
  walk: { label: "Walk", verb: "Walk", goalPaceSecPerMile: 900, warmupSeconds: 60 }, // 15:00/mi, 1 min warm-up
  sprint: { label: "Sprint", verb: "Sprint", goalPaceSecPerMile: 360, warmupSeconds: 0 }, // 6:00/mi, no ramp-up
};
export const WORKOUT_TYPE_ORDER = ["run", "walk", "sprint"];

// Rows saved before the workout_type column existed default to "run" server-side
// (see the migration), but guard here too in case a row is ever missing it.
export const filterRunsByType = (runs, type) => runs.filter((r) => (r.workout_type ?? "run") === type);

export const MAX_HR = 190; // ≈ 220 - age(30), used for HR-zone breathing guidance

export const HR_ZONES = [
  { zone: 1, name: "Recovery", min: 0, max: 0.6, color: T.sub, pattern: "Box Breathing · 4-4-4-4", cue: "Nasal in for 4, hold 4, nasal out 4, hold 4." },
  { zone: 2, name: "Easy Aerobic", min: 0.6, max: 0.7, color: T.accent2, pattern: "Rhythmic 3:3", cue: "Inhale for 3 steps, exhale for 3 steps." },
  { zone: 3, name: "Tempo", min: 0.7, max: 0.8, color: T.accent1, pattern: "Rhythmic 2:2", cue: "Inhale for 2 steps, exhale for 2 steps." },
  { zone: 4, name: "Threshold", min: 0.8, max: 0.9, color: T.amber, pattern: "2:1 Breathing", cue: "Inhale for 2 steps, exhale sharply for 1." },
  { zone: 5, name: "Max Effort", min: 0.9, max: 2, color: T.red, pattern: "1:1 Breathing", cue: "Quick inhale, forceful exhale — every stride." },
];

export const CORE_EXERCISES = [
  { id: "plank", name: "Plank", type: "hold", target: 60, unit: "sec" },
  { id: "situps", name: "Sit-Ups", type: "reps", target: 25, unit: "reps" },
  { id: "twists", name: "Russian Twists", type: "reps", target: 30, unit: "reps" },
  { id: "raises", name: "Leg Raises", type: "reps", target: 20, unit: "reps" },
  { id: "climbers", name: "Mountain Climbers", type: "reps", target: 40, unit: "reps" },
  { id: "crunches", name: "Bicycle Crunches", type: "reps", target: 30, unit: "reps" },
];
export const CORE_GOAL = CORE_EXERCISES.length;

export const CORE_HISTORY = []; // { date, completed, totalReps, holdSec } — core sessions aren't persisted yet

/* ───────── profile (sex + birthdate, local-only for now — gates the Cycle card) ───────── */

export const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "unspecified", label: "Prefer not to say" },
];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// A wide-enough range for a birth year picker — "all" years a real user could
// plausibly have been born in, not just the last few.
export const BIRTH_YEAR_MIN = new Date().getFullYear() - 100;
export const BIRTH_YEAR_MAX = new Date().getFullYear() - 5;

/* ───────── derive run analytics from persisted `runs` rows (see supabase/migrations) ─────────
   Each row: { created_at, distance_mi, duration_sec, avg_pace_sec, sprints, avg_hr,
   avg_cadence, rpe, vo2max, pace_minutes, sprint_minutes }. Rows arrive newest-first. */

const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// History screen / achievement / ACWR shape: { date, sprints, distance, pace, ... }
export const deriveHistory = (runs) =>
  runs.map((r) => ({
    date: shortDate(r.created_at),
    sprints: r.sprints,
    distance: `${r.distance_mi.toFixed(2)} mi`,
    pace: r.avg_pace_sec,
    durationSec: r.duration_sec,
    avgHr: r.avg_hr,
    cadence: r.avg_cadence,
    groundContactTime: r.avg_ground_contact_time_ms,
    verticalOscillation: r.avg_vertical_oscillation_cm,
    strideLength: r.avg_stride_length_m,
    runningPower: r.avg_running_power_watts,
    rpe: r.rpe,
    vo2max: r.vo2max,
    paceMinutes: r.pace_minutes || [],
    sprintMinutes: new Set(r.sprint_minutes || []),
  }));

const isoWeekLabel = (iso) => {
  const d = new Date(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${shortDate(monday)} – ${shortDate(sunday)}`;
};

export const deriveMonthlyHistory = (runs) => {
  const groups = new Map();
  runs.forEach((r) => {
    const key = isoWeekLabel(r.created_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return Array.from(groups.entries()).map(([period, group]) => ({
    period,
    runs: group.length,
    avgPace: group.reduce((s, r) => s + r.avg_pace_sec, 0) / group.length,
    distance: `${group.reduce((s, r) => s + r.distance_mi, 0).toFixed(2)} mi`,
  }));
};

export const deriveVO2MaxHistory = (runs) =>
  [...runs].reverse().filter((r) => r.vo2max != null).map((r) => Math.round(r.vo2max * 10) / 10);

export const deriveVO2MaxLabels = (runs) =>
  [...runs].reverse().filter((r) => r.vo2max != null).map((r) => shortDate(r.created_at));

// Longest consecutive run of calendar days with at least one logged run.
export const deriveStreaks = (runs) => {
  if (runs.length === 0) return { current: 0, longest: 0 };
  const dayMs = 86400000;
  const toDayNum = (d) => Math.floor(new Date(d).setHours(0, 0, 0, 0) / dayMs);
  const days = [...new Set(runs.map((r) => toDayNum(r.created_at)))].sort((a, b) => b - a);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i - 1] - days[i] === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const todayNum = toDayNum(Date.now());
  let current = 0;
  if (days[0] === todayNum || days[0] === todayNum - 1) {
    current = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i - 1] - days[i] === 1) current++;
      else break;
    }
  }
  return { current, longest };
};

// Sensor-completeness score for the newest persisted run. Core GPS workout
// fields contribute 40 points; each available heart-rate/cadence/Watch gait
// field contributes 10. This reflects stored evidence, not a fixed tier.
export const deriveConfidence = (runs) => {
  if (runs.length === 0) return 0;
  const r = runs[0];
  let score = r.distance_mi > 0 && r.duration_sec > 0 && r.avg_pace_sec > 0 ? 40 : 0;
  [
    r.avg_hr,
    r.avg_cadence,
    r.avg_ground_contact_time_ms,
    r.avg_vertical_oscillation_cm,
    r.avg_stride_length_m,
    r.avg_running_power_watts,
  ].forEach((value) => {
    if (Number.isFinite(value) && value > 0) score += 10;
  });
  return score;
};

export const deriveTodayStats = (runs) => {
  const todayStr = new Date().toDateString();
  const today = runs.filter((r) => new Date(r.created_at).toDateString() === todayStr);
  return {
    sprints: today.reduce((s, r) => s + r.sprints, 0),
    distance: today.reduce((s, r) => s + r.distance_mi, 0),
    duration: today.reduce((s, r) => s + r.duration_sec, 0),
    maxSpeed: today.reduce((m, r) => Math.max(m, r.distance_mi / (r.duration_sec / 3600 || 1)), 0),
  };
};

export const deriveWeekBars = (runs) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const bars = [0, 0, 0, 0, 0, 0, 0];
  runs.forEach((r) => {
    const diffDays = Math.floor((new Date(r.created_at) - startOfWeek) / 86400000);
    if (diffDays >= 0 && diffDays < 7) bars[diffDays] += r.sprints;
  });
  return bars;
};

export const TIER_STYLE = {
  bronze: { color: "#B08D57", label: "Bronze", xp: 10 },
  silver: { color: "#C8CDD6", label: "Silver", xp: 25 },
  gold: { color: T.amber, label: "Gold", xp: 75, glow: true },
  legendary: { color: T.accent1, label: "Legendary", xp: 250, glow: true, particles: true },
};

// check/progress receive a computed `ctx` (see achievementContext() below).
export const ACHIEVEMENTS = [
  { id: "long_hauler", name: "Long Hauler", desc: "Log a run of 5+ miles", tier: "bronze", category: "Distance",
    check: (ctx) => ctx.longestRun >= 5, progress: (ctx) => ({ current: ctx.longestRun, target: 5, unit: "mi" }) },
  { id: "first_10k", name: "First 10K", desc: "Complete a run of 10K (6.2 mi) or more", tier: "silver", category: "Distance",
    check: (ctx) => ctx.longestRun >= 6.2, progress: (ctx) => ({ current: ctx.longestRun, target: 6.2, unit: "mi" }) },
  { id: "century_club", name: "Century Club", desc: "100 lifetime miles logged", tier: "silver", category: "Distance",
    check: (ctx) => ctx.lifetimeMiles >= 100, progress: (ctx) => ({ current: ctx.lifetimeMiles, target: 100, unit: "mi" }) },
  { id: "half_marathon", name: "Half Marathon", desc: "Complete a 13.1 mi run", tier: "gold", category: "Distance",
    check: (ctx) => ctx.longestRun >= 13.1, progress: (ctx) => ({ current: ctx.longestRun, target: 13.1, unit: "mi" }) },
  { id: "marathon", name: "Marathon", desc: "Complete a 26.2 mi run", tier: "legendary", category: "Distance",
    check: (ctx) => ctx.longestRun >= 26.2, progress: (ctx) => ({ current: ctx.longestRun, target: 26.2, unit: "mi" }) },

  { id: "new_pr", name: "Personal Best", desc: "Your fastest logged pace", tier: "silver", category: "Pace",
    check: (ctx) => ctx.hasHistory, progress: () => null },
  { id: "sub7_club", name: "Sub-7 Club", desc: "Average under 7:00/mi for a full run", tier: "gold", category: "Pace",
    check: (ctx) => ctx.bestPace < 420, progress: (ctx) => ({ current: ctx.bestPace, target: 420, unit: "sec/mi", invert: true }) },

  { id: "streak_3", name: "Getting Started", desc: "3-day streak", tier: "bronze", category: "Consistency",
    check: (ctx) => ctx.currentStreak >= 3, progress: (ctx) => ({ current: ctx.currentStreak, target: 3, unit: "days" }) },
  { id: "streak_7", name: "Week Warrior", desc: "7-day streak", tier: "silver", category: "Consistency",
    check: (ctx) => ctx.currentStreak >= 7, progress: (ctx) => ({ current: ctx.currentStreak, target: 7, unit: "days" }) },
  { id: "streak_30", name: "Unstoppable", desc: "30-day streak", tier: "gold", category: "Consistency",
    check: (ctx) => ctx.longestStreak >= 30, progress: (ctx) => ({ current: ctx.longestStreak, target: 30, unit: "days" }) },
  { id: "streak_100", name: "Legendary Streak", desc: "100-day streak", tier: "legendary", category: "Consistency",
    check: (ctx) => ctx.longestStreak >= 100, progress: (ctx) => ({ current: ctx.longestStreak, target: 100, unit: "days" }) },

  { id: "hill_climber", name: "Hill Climber", desc: "1,000 ft cumulative elevation gain", tier: "bronze", category: "Elevation",
    check: (ctx) => ctx.elevationFt >= 1000, progress: (ctx) => ({ current: ctx.elevationFt, target: 1000, unit: "ft" }) },
  { id: "peak_performer", name: "Peak Performer", desc: "10,000 ft cumulative elevation gain", tier: "gold", category: "Elevation",
    check: (ctx) => ctx.elevationFt >= 10000, progress: (ctx) => ({ current: ctx.elevationFt, target: 10000, unit: "ft" }) },

  { id: "balanced_week", name: "Balanced Week", desc: "Readiness stayed above 70", tier: "silver", category: "Recovery",
    check: (ctx) => ctx.readiness >= 70, progress: (ctx) => ({ current: ctx.readiness, target: 70, unit: "" }) },

  { id: "calibrated", name: "Calibrated", desc: "Sustain a 90+ data-confidence score", tier: "gold", category: "Trust",
    check: (ctx) => ctx.confidence >= 90, progress: (ctx) => ({ current: ctx.confidence, target: 90, unit: "" }) },

  { id: "core_streak", name: "Core Strength", desc: "Hit your full core goal 5 sessions running", tier: "silver", category: "Core",
    check: (ctx) => ctx.coreSessions >= 5, progress: (ctx) => ({ current: ctx.coreSessions, target: 5, unit: "sessions" }) },
];

export const achievementContext = ({ readiness, coreCompleted, history, streaks, confidence }) => ({
  longestRun: history.length ? Math.max(...history.map((w) => parseFloat(w.distance))) : 0,
  lifetimeMiles: Math.round(history.reduce((sum, w) => sum + parseFloat(w.distance), 0) * 10) / 10,
  bestPace: history.length ? Math.min(...history.map((w) => w.pace)) : Infinity,
  hasHistory: history.length > 0,
  currentStreak: streaks.current,
  longestStreak: streaks.longest,
  elevationFt: 0, // no GPS elevation capture in this app
  readiness,
  confidence,
  coreSessions: CORE_HISTORY.filter((h) => h.completed >= CORE_GOAL).length + (coreCompleted >= CORE_GOAL ? 1 : 0),
});

export const RPE_LABELS = { 1: "Very easy", 3: "Easy", 5: "Moderate", 7: "Hard", 9: "Very hard", 10: "Max effort" };

export const xpForTier = (tier) => TIER_STYLE[tier].xp;

export const computeGamification = (ctx) => {
  const unlocked = ACHIEVEMENTS.filter((a) => a.check(ctx));
  const totalXP = unlocked.reduce((sum, a) => sum + xpForTier(a.tier), 0);
  const level = 1 + Math.floor(totalXP / 100);
  const xpIntoLevel = totalXP % 100;
  return { unlocked, unlockedIds: new Set(unlocked.map((a) => a.id)), totalXP, level, xpIntoLevel };
};

// Estimated relative-effort score (TSS-style), not a clinically validated Training Stress Score.
const THRESHOLD_PACE_SEC = 400;
export const estimateTSS = (entry) => {
  const distance = parseFloat(entry.distance);
  const intensityFactor = THRESHOLD_PACE_SEC / entry.pace;
  return Math.round(distance * intensityFactor * 20);
};

// Acute:chronic workload ratio — acute = avg of most recent 3 runs, chronic = avg of all logged runs.
export const computeACWR = (history) => {
  if (history.length === 0) {
    return { hasData: false, acute: 0, chronic: 0, ratio: 0, risk: "No runs yet", riskColor: T.sub };
  }
  const tssList = history.map(estimateTSS);
  const acute = tssList.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, tssList.length);
  const chronic = tssList.reduce((a, b) => a + b, 0) / tssList.length;
  const ratio = chronic > 0 ? acute / chronic : 1;
  let risk = "Balanced";
  let riskColor = T.accent1;
  if (ratio > 1.5) {
    risk = "Elevated risk";
    riskColor = T.red;
  } else if (ratio > 1.3) {
    risk = "Ramping up";
    riskColor = T.amber;
  } else if (ratio < 0.8) {
    risk = "Detraining";
    riskColor = T.sub;
  }
  return { hasData: true, acute: Math.round(acute), chronic: Math.round(chronic), ratio: Math.round(ratio * 100) / 100, risk, riskColor };
};

// Explain exactly which persisted sensors powered the latest run.
export const confidenceBreakdown = (history) => {
  if (history.length === 0) return [{ label: "Status", value: "No runs logged yet", good: null }];
  const latest = history[0];
  const hasWatchGait = [
    latest.groundContactTime,
    latest.verticalOscillation,
    latest.strideLength,
    latest.runningPower,
  ].some((value) => Number.isFinite(value) && value > 0);
  return [
    { label: "GPS workout", value: latest.durationSec > 0 ? "Stored" : "Missing", good: latest.durationSec > 0 },
    { label: "Heart rate", value: latest.avgHr > 0 ? "Stored" : "Unavailable", good: latest.avgHr > 0 },
    { label: "Cadence", value: latest.cadence > 0 ? "Stored" : "Unavailable", good: latest.cadence > 0 },
    { label: "Running dynamics", value: hasWatchGait ? "Apple Watch" : "Unavailable", good: hasWatchGait },
  ];
};

export const FALLBACK_AI = {
  postWorkoutInsight: "Complete your first workout and your coach will break down what happened, minute by minute.",
  weeklyNarrative: "Once you've logged a few runs, you'll see your pace and consistency trends here.",
  liveCues: [
    "Drive your knees — hold this cadence.",
    "Relax your shoulders, quick feet.",
    "Halfway through this rep. Stay tall.",
    "Strong finish — kick for ten more seconds.",
    "Ease off. Breathe. Recover for the next one.",
  ],
  cycleTip: "Log your cycle day and we'll tailor training intensity to where you are in your cycle.",
  coreInsight: "Finish your first core session to start tracking progress here.",
  vo2maxNote: "Complete a few runs and we'll estimate your VO2max trend here.",
  weeklyPlan: [
    { day: "Mon", focus: "Easy 20-min jog", intensity: 1 },
    { day: "Tue", focus: "Rest or mobility", intensity: 0 },
    { day: "Wed", focus: "4 × 100m strides", intensity: 2 },
    { day: "Thu", focus: "Core + easy walk", intensity: 1 },
    { day: "Fri", focus: "Rest", intensity: 0 },
    { day: "Sat", focus: "Easy 20-min run", intensity: 1 },
    { day: "Sun", focus: "Rest + stretching", intensity: 0 },
  ],
};

/* ───────── helpers ───────── */

export const fmtPace = (secs) =>
  `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`;
export const fmtClock = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export const readinessColor = (score) =>
  score >= 80 ? T.accent1 : score >= 55 ? T.accent2 : T.red;
export const readinessLabel = (score) => (score >= 80 ? "Great" : score >= 55 ? "Good" : "Low");

export const phaseFor = (day) => {
  if (day <= 5) return "Menstrual";
  if (day <= 13) return "Follicular";
  if (day <= 16) return "Ovulation";
  return "Luteal";
};

export const PHASE_INFO = {
  Menstrual: {
    range: "Days 1–5",
    desc: "Your period. Energy is typically lowest early in this phase.",
    tip: "Keep intensity light — easy jogs, mobility, and gentle strides are ideal.",
  },
  Follicular: {
    range: "Days 6–13",
    desc: "Rising estrogen. Energy and recovery capacity climb through this phase.",
    tip: "Schedule your hardest sprint sessions here — your body adapts fastest now.",
  },
  Ovulation: {
    range: "Days 14–16",
    desc: "Peak hormone levels. Power output tends to peak, but joints are laxer.",
    tip: "Go for peak-speed work, but warm up thoroughly to protect tendons.",
  },
  Luteal: {
    range: "Days 17–28",
    desc: "Progesterone rises. Core temperature is higher; hard efforts feel harder.",
    tip: "Favor steady aerobic volume and technique work over max-effort sprints.",
  },
};

export const vo2maxCategory = (v) => {
  if (v >= 52) return { label: "Excellent", color: T.accent1 };
  if (v >= 47) return { label: "Very Good", color: T.accent1 };
  if (v >= 42) return { label: "Good", color: T.accent2 };
  if (v >= 35) return { label: "Fair", color: T.amber };
  return { label: "Below Average", color: T.red };
};

export const hrZoneFor = (hr, maxHR = MAX_HR) => {
  const pct = hr / maxHR;
  return HR_ZONES.find((z) => pct >= z.min && pct < z.max) || HR_ZONES[HR_ZONES.length - 1];
};

// ACSM submaximal running equation: VO2 (ml/kg/min) = 0.2 × speed(m/min) + 3.5
export const estimateVO2 = (speedMph) => 0.2 * speedMph * 26.8224 + 3.5;

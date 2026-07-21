import { T } from "./theme";

/* ───────── sample data (wire to HealthKit in production) ───────── */

export const SPRINTS_TODAY = 8;
export const SPRINT_GOAL = 10;
export const WEEK_BARS = [6, 9, 4, 10, 7, 0, 8]; // Su..Sa, today = index 2 (Tue)
export const TODAY_IDX = 2;
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export const HISTORY = [
  { date: "Jul 14", sprints: 8, distance: "3.2 mi", pace: 412 },
  { date: "Jul 12", sprints: 10, distance: "3.8 mi", pace: 425 },
  { date: "Jul 10", sprints: 7, distance: "2.9 mi", pace: 418 },
  { date: "Jul 8", sprints: 9, distance: "3.5 mi", pace: 436 },
  { date: "Jul 6", sprints: 6, distance: "2.6 mi", pace: 431 },
  { date: "Jul 4", sprints: 8, distance: "3.1 mi", pace: 447 },
]; // pace in seconds per mile, newest first

export const PACE_MINUTES = [462, 448, 431, 395, 418, 442, 388, 402, 455, 391, 424, 438];
export const SPRINT_MINUTES = new Set([3, 6, 9]); // zero-indexed sprint-effort minutes

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

export const CORE_HISTORY = [
  { date: "Jul 14", completed: 4, totalReps: 96, holdSec: 48 },
  { date: "Jul 12", completed: 6, totalReps: 138, holdSec: 65 },
  { date: "Jul 10", completed: 5, totalReps: 110, holdSec: 55 },
  { date: "Jul 8", completed: 3, totalReps: 80, holdSec: 40 },
  { date: "Jul 6", completed: 6, totalReps: 145, holdSec: 70 },
];

export const VO2MAX_HISTORY = [44.8, 45.3, 45.9, 46.4, 46.9, 47.5, 47.9]; // ml/kg/min, oldest → newest
export const VO2MAX_LABELS = ["6wk", "5wk", "4wk", "3wk", "2wk", "1wk", "Now"];

export const FALLBACK_AI = {
  postWorkoutInsight:
    "Your strongest surge came at minute 7 — you held 6:28/mi for the full interval. Recovery between sprints 5 and 6 ran long; tighten that gap next session.",
  weeklyNarrative:
    "Across your last four runs, average pace improved 35 seconds while sprint volume held steady. Your consistency on Tuesdays and Thursdays is driving the trend.",
  liveCues: [
    "Drive your knees — hold this cadence.",
    "Relax your shoulders, quick feet.",
    "Halfway through this rep. Stay tall.",
    "Strong finish — kick for ten more seconds.",
    "Ease off. Breathe. Recover for the next one.",
  ],
  cycleTip:
    "You're in a high-energy window — this is a great week for your hardest sprint sessions. Prioritize protein within 30 minutes after finishing.",
  coreInsight:
    "You hit 4 of 6 core exercises today, and your plank hold improved to 48 seconds — an 8-second gain from last session. Push for a full minute next time.",
  vo2maxNote:
    "Your estimated VO2max climbed to 47.9 ml/kg/min, up from 44.8 six weeks ago — a strong sign your aerobic engine is adapting to the sprint work.",
  weeklyPlan: [
    { day: "Mon", focus: "Recovery jog + strides", intensity: 1 },
    { day: "Tue", focus: "6 × 200m hill sprints", intensity: 3 },
    { day: "Wed", focus: "Mobility + core", intensity: 1 },
    { day: "Thu", focus: "8 × 150m flat sprints", intensity: 3 },
    { day: "Fri", focus: "Easy 3 mi aerobic", intensity: 2 },
    { day: "Sat", focus: "10 × 100m accelerations", intensity: 3 },
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

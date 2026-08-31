import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";

/* ─────────────────────────────────────────────
   Stride — Sprint, Core & Pace Tracking Prototype
   Tracks core exercises, run pace/sprints, VO2max,
   and HR-zone-based breathing technique.
   Design direction: 1c "Split Dark"
   ───────────────────────────────────────────── */

const T = {
  bg: "#111214",
  cardBg: "#1B1D20",
  ink: "#F5F5F4",
  sub: "#9A9DA3",
  hair: "#2A2C30",
  accent1: "oklch(0.72 0.17 155)",
  accent2: "oklch(0.72 0.17 195)",
  red: "oklch(0.62 0.16 25)",
  amber: "oklch(0.75 0.14 85)",
  radius: 22,
  shadow: "0 10px 30px rgba(0,0,0,0.35)",
  pillActiveBg: "oklch(0.72 0.17 155 / 0.15)",
};

const card = (extra = {}) => ({
  background: T.cardBg,
  borderRadius: T.radius,
  boxShadow: T.shadow,
  ...extra,
});

/* ───────── run history — persisted to Supabase, derived client-side (see below) ───────── */

const SPRINT_GOAL = 10;
const TODAY_IDX = new Date().getDay(); // 0=Sun..6=Sat
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const MAX_HR = 190; // ≈ 220 - age(30), used for HR-zone breathing guidance

const HR_ZONES = [
  { zone: 1, name: "Recovery", min: 0, max: 0.6, color: T.sub, pattern: "Box Breathing · 4-4-4-4", cue: "Nasal in for 4, hold 4, nasal out 4, hold 4." },
  { zone: 2, name: "Easy Aerobic", min: 0.6, max: 0.7, color: T.accent2, pattern: "Rhythmic 3:3", cue: "Inhale for 3 steps, exhale for 3 steps." },
  { zone: 3, name: "Tempo", min: 0.7, max: 0.8, color: T.accent1, pattern: "Rhythmic 2:2", cue: "Inhale for 2 steps, exhale for 2 steps." },
  { zone: 4, name: "Threshold", min: 0.8, max: 0.9, color: T.amber, pattern: "2:1 Breathing", cue: "Inhale for 2 steps, exhale sharply for 1." },
  { zone: 5, name: "Max Effort", min: 0.9, max: 2, color: T.red, pattern: "1:1 Breathing", cue: "Quick inhale, forceful exhale — every stride." },
];

const CORE_EXERCISES = [
  { id: "plank", name: "Plank", type: "hold", target: 60, unit: "sec" },
  { id: "situps", name: "Sit-Ups", type: "reps", target: 25, unit: "reps" },
  { id: "twists", name: "Russian Twists", type: "reps", target: 30, unit: "reps" },
  { id: "raises", name: "Leg Raises", type: "reps", target: 20, unit: "reps" },
  { id: "climbers", name: "Mountain Climbers", type: "reps", target: 40, unit: "reps" },
  { id: "crunches", name: "Bicycle Crunches", type: "reps", target: 30, unit: "reps" },
];
const CORE_GOAL = CORE_EXERCISES.length;

const CORE_HISTORY = []; // { date, completed, totalReps, holdSec } — core sessions aren't persisted yet

/* ───────── derive run analytics from persisted `runs` rows (see supabase/migrations) ─────────
   Each row: { created_at, distance_mi, duration_sec, avg_pace_sec, sprints, avg_hr,
   avg_cadence, rpe, vo2max, pace_minutes, sprint_minutes }. Rows arrive newest-first. */

const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// History screen / achievement / ACWR shape: { date, sprints, distance, pace, ... }
const deriveHistory = (runs) =>
  runs.map((r) => ({
    date: shortDate(r.created_at),
    sprints: r.sprints,
    distance: `${r.distance_mi.toFixed(2)} mi`,
    pace: r.avg_pace_sec,
    avgHr: r.avg_hr,
    cadence: r.avg_cadence,
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

const deriveMonthlyHistory = (runs) => {
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

const deriveVO2MaxHistory = (runs) =>
  [...runs].reverse().filter((r) => r.vo2max != null).map((r) => Math.round(r.vo2max * 10) / 10);

const deriveVO2MaxLabels = (runs) =>
  [...runs].reverse().filter((r) => r.vo2max != null).map((r) => shortDate(r.created_at));

// Longest consecutive run of calendar days with at least one logged run.
const deriveStreaks = (runs) => {
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

// Illustrative composite — this app has no real multi-sensor stream to grade (see
// confidenceBreakdown() below), so it's a fixed "Fallback tier" value once any run exists.
const deriveConfidence = (runs) => (runs.length > 0 ? 72 : 0);

const deriveTodayStats = (runs) => {
  const todayStr = new Date().toDateString();
  const today = runs.filter((r) => new Date(r.created_at).toDateString() === todayStr);
  return {
    sprints: today.reduce((s, r) => s + r.sprints, 0),
    distance: today.reduce((s, r) => s + r.distance_mi, 0),
    duration: today.reduce((s, r) => s + r.duration_sec, 0),
    maxSpeed: today.reduce((m, r) => Math.max(m, r.distance_mi / (r.duration_sec / 3600 || 1)), 0),
  };
};

const deriveWeekBars = (runs) => {
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

const TIER_STYLE = {
  bronze: { color: "#B08D57", label: "Bronze", xp: 10 },
  silver: { color: "#C8CDD6", label: "Silver", xp: 25 },
  gold: { color: T.amber, label: "Gold", xp: 75, glow: true },
  legendary: { color: T.accent1, label: "Legendary", xp: 250, glow: true, particles: true },
};

// check/progress receive a computed `ctx` (see achievementContext() below).
const ACHIEVEMENTS = [
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

const achievementContext = ({ readiness, coreCompleted, history, streaks, confidence }) => ({
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

const RPE_LABELS = { 1: "Very easy", 3: "Easy", 5: "Moderate", 7: "Hard", 9: "Very hard", 10: "Max effort" };

const FALLBACK_AI = {
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

const fmtPace = (secs) =>
  `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`;
const fmtClock = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const readinessColor = (score) =>
  score >= 80 ? T.accent1 : score >= 55 ? T.accent2 : T.red;
const readinessLabel = (score) => (score >= 80 ? "Great" : score >= 55 ? "Good" : "Low");

const phaseFor = (day) => {
  if (day <= 5) return "Menstrual";
  if (day <= 13) return "Follicular";
  if (day <= 16) return "Ovulation";
  return "Luteal";
};

const PHASE_INFO = {
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

const vo2maxCategory = (v) => {
  if (v >= 52) return { label: "Excellent", color: T.accent1 };
  if (v >= 47) return { label: "Very Good", color: T.accent1 };
  if (v >= 42) return { label: "Good", color: T.accent2 };
  if (v >= 35) return { label: "Fair", color: T.amber };
  return { label: "Below Average", color: T.red };
};

const hrZoneFor = (hr, maxHR = MAX_HR) => {
  const pct = hr / maxHR;
  return HR_ZONES.find((z) => pct >= z.min && pct < z.max) || HR_ZONES[HR_ZONES.length - 1];
};

// ACSM submaximal running equation: VO2 (ml/kg/min) = 0.2 × speed(m/min) + 3.5
const estimateVO2 = (speedMph) => 0.2 * speedMph * 26.8224 + 3.5;

const xpForTier = (tier) => TIER_STYLE[tier].xp;

const computeGamification = (ctx) => {
  const unlocked = ACHIEVEMENTS.filter((a) => a.check(ctx));
  const totalXP = unlocked.reduce((sum, a) => sum + xpForTier(a.tier), 0);
  const level = 1 + Math.floor(totalXP / 100);
  const xpIntoLevel = totalXP % 100;
  return { unlocked, unlockedIds: new Set(unlocked.map((a) => a.id)), totalXP, level, xpIntoLevel };
};

// Estimated relative-effort score (TSS-style), not a clinically validated Training Stress Score.
// intensityFactor scales toward 1 as pace approaches a 6:40/mi reference threshold pace.
const THRESHOLD_PACE_SEC = 400;
const estimateTSS = (entry) => {
  const distance = parseFloat(entry.distance);
  const intensityFactor = THRESHOLD_PACE_SEC / entry.pace;
  return Math.round(distance * intensityFactor * 20);
};

// Acute:chronic workload ratio — acute = avg of most recent 3 runs, chronic = avg of all logged runs.
const computeACWR = (history) => {
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

// Illustrative confidence breakdown — this app has no real GPS/sensor stream to grade,
// so the inputs are fixed rather than computed from a live signal. See spec section 3.
const confidenceBreakdown = (history) =>
  history.length === 0
    ? [{ label: "Status", value: "No runs logged yet", good: null }]
    : [
        { label: "GPS signal", value: "Strong", good: true },
        { label: "Sensor agreement", value: "High", good: true },
        { label: "Source", value: "Phone GPS + accelerometer (Fallback tier)", good: null },
      ];

/* ───────── small shared components ───────── */

function Eyebrow({ children, color = T.accent1 }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color }}>
      {children}
    </div>
  );
}

function Chevron({ dir = "right", color = T.sub, size = 12 }) {
  const rot = { right: 45, left: 225, up: -45, down: 135 }[dir];
  return (
    <span
      style={{
        display: "inline-block",
        width: size * 0.6,
        height: size * 0.6,
        borderTop: `2px solid ${color}`,
        borderRight: `2px solid ${color}`,
        transform: `rotate(${rot}deg)`,
      }}
    />
  );
}

function RunningLegs({ size = 90, color = T.accent1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <g style={{ transformOrigin: "50px 36px", animation: "legSwingBack 0.64s ease-in-out infinite" }}>
        <path d="M50 36 L38 68 L30 94 L42 94 L52 68 L56 36 Z" fill={color} opacity={0.5} />
      </g>
      <g style={{ transformOrigin: "50px 36px", animation: "legSwingFront 0.64s ease-in-out infinite" }}>
        <path d="M50 36 L62 68 L70 94 L58 94 L48 68 L44 36 Z" fill={color} />
      </g>
      <circle cx="50" cy="22" r="10" fill={color} />
    </svg>
  );
}

function Logomark({ size = 72, radius = 22, fontSize = 32 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${T.accent1}, ${T.accent2})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize,
      }}
    >
      S
    </div>
  );
}

function BackHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 56 }}>
      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          background: T.cardBg,
          border: `1px solid ${T.hair}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Chevron dir="left" color={T.ink} />
      </button>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{title}</div>
    </div>
  );
}

function StatCard({ value, label, valueColor = T.ink }) {
  return (
    <div style={card({ padding: "14px 12px", textAlign: "center" })}>
      <div style={{ fontSize: 17, fontWeight: 700, color: valueColor }}>{value}</div>
      <div style={{ fontSize: 11, color: T.sub, marginTop: 3 }}>{label}</div>
    </div>
  );
}

/* ───────── Progress ring ───────── */

function ProgressRing({ value, goal, unit = "sprints" }) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / goal);
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={T.accent1} />
            <stop offset="100%" stopColor={T.accent2} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.hair} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 800, color: T.ink, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>of {goal} {unit}</div>
      </div>
    </div>
  );
}

/* ───────── HR zone & breathing guidance ───────── */

function BreathingGuide({ hr, compact = false }) {
  const z = hrZoneFor(hr);
  const duration = { 1: 16, 2: 6, 3: 4, 4: 3, 5: 2 }[z.zone];
  return (
    <div style={card({ padding: compact ? 14 : 16, display: "flex", alignItems: "center", gap: 14 })}>
      <div style={{ width: 46, height: 46, borderRadius: 23, background: `${z.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: 20, height: 20, borderRadius: 10, background: z.color, animation: `breathePulse ${duration}s ease-in-out infinite` }} />
      </div>
      <div style={{ flex: 1 }}>
        <Eyebrow color={z.color}>Zone {z.zone} · {z.name}</Eyebrow>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginTop: 2 }}>{z.pattern}</div>
        {!compact && <div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>{z.cue}</div>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{Math.round(hr)} bpm</div>
    </div>
  );
}

/* ───────── gamification components ───────── */

function AchievementBadge({ achievement, unlocked, ctx, onClick }) {
  const tier = TIER_STYLE[achievement.tier];
  const prog = !unlocked && achievement.progress ? achievement.progress(ctx) : null;
  const pct = prog ? Math.min(1, prog.invert ? prog.target / Math.max(prog.current, 1) : prog.current / prog.target) : 0;
  return (
    <button
      onClick={onClick}
      style={card({
        padding: 14,
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        opacity: unlocked ? 1 : 0.55,
        boxShadow: unlocked && tier.glow ? `0 0 0 1px ${tier.color}55, 0 0 24px ${tier.color}40` : T.shadow,
      })}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            flexShrink: 0,
            background: unlocked ? `${tier.color}22` : T.hair,
            border: `1.5px solid ${unlocked ? tier.color : T.hair}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          {unlocked ? (achievement.tier === "legendary" ? "★" : "●") : "🔒"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{achievement.name}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: tier.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {tier.label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{achievement.desc}</div>
          {prog && (
            <div style={{ height: 4, background: T.hair, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct * 100}%`, background: tier.color, borderRadius: 2 }} />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function TierPill({ tier }) {
  const t = TIER_STYLE[tier];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: t.color,
        border: `1px solid ${t.color}`,
        borderRadius: 999,
        padding: "2px 8px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {t.label}
    </span>
  );
}

/* ───────── Screens ───────── */

function Splash() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <RunningLegs />
      <div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>Stride</div>
    </div>
  );
}

function Login({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const field = {
    background: T.cardBg,
    border: `1px solid ${T.hair}`,
    borderRadius: 14,
    padding: "15px 16px",
    color: T.ink,
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  };

  const submit = async () => {
    setError("");
    setNotice("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error: err } = await onSignIn(email.trim(), password);
        if (err) setError(err.message);
      } else {
        const { error: err, needsConfirmation } = await onSignUp(email.trim(), password);
        if (err) setError(err.message);
        else if (needsConfirmation) setNotice("Check your email to confirm your account, then log in.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginBottom: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <Logomark size={56} radius={18} fontSize={24} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </div>
        <div style={{ fontSize: 13, color: T.sub }}>Track sprints, strides and recovery</div>
      </div>
      <input
        style={field}
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoCapitalize="none"
        autoComplete="email"
      />
      <input
        style={field}
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}
      {notice && <div style={{ fontSize: 13, color: T.accent1 }}>{notice}</div>}
      <button
        onClick={submit}
        disabled={loading}
        style={{
          background: T.accent1,
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          border: "none",
          borderRadius: 999,
          padding: "15px 0",
          cursor: loading ? "default" : "pointer",
          marginTop: 4,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Please wait…" : mode === "signin" ? "Log In" : "Sign Up"}
      </button>
      <div style={{ fontSize: 13, color: T.sub, textAlign: "center", marginTop: 8 }}>
        {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
        <span
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setNotice("");
          }}
          style={{ color: T.accent1, fontWeight: 600, cursor: "pointer" }}
        >
          {mode === "signin" ? "Sign up" : "Log in"}
        </span>
      </div>
    </div>
  );
}

function Summary({
  ai,
  aiLoading,
  onRegenerate,
  readiness,
  cycleDay,
  cycleLength,
  openCycle,
  openRecovery,
  openAchievements,
  openTrainingLoad,
  openForm,
  openDevices,
  achievementCtx,
  history,
  todayStats,
  weekBars,
  onSignOut,
}) {
  const phase = phaseFor(cycleDay);
  const periodIn = cycleLength - cycleDay + 1;
  const maxBar = Math.max(...weekBars, 1);
  const dots = ["", T.sub, T.accent2, T.accent1]; // intensity 0..3
  const gamification = computeGamification(achievementCtx);
  const trainingLoad = computeACWR(history);
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, color: T.sub }}>
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{greeting}</div>
        </div>
        <button
          onClick={onSignOut}
          style={{ background: "none", border: "none", color: T.sub, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}
        >
          Log Out
        </button>
      </div>

      <div style={card({ padding: 24 })}>
        <ProgressRing value={todayStats.sprints} goal={SPRINT_GOAL} unit="sprints" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <StatCard value={`${todayStats.maxSpeed.toFixed(1)} mph`} label="Max Speed" />
        <StatCard value={`${todayStats.distance.toFixed(1)} mi`} label="Distance" />
        <StatCard value={fmtClock(todayStats.duration)} label="Duration" />
      </div>

      <button onClick={openRecovery} style={card({ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", cursor: "pointer", textAlign: "left", width: "100%" })}>
        <div>
          <Eyebrow>Recovery</Eyebrow>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginTop: 4 }}>
            Readiness {readinessLabel(readiness)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: readinessColor(readiness) }}>{readiness}</div>
          <Chevron />
        </div>
      </button>

      <button onClick={openCycle} style={card({ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", cursor: "pointer", textAlign: "left", width: "100%" })}>
        <div>
          <Eyebrow>Cycle · Day {cycleDay}</Eyebrow>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginTop: 4 }}>{phase} phase</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13, color: T.sub }}>Period in {periodIn}d</div>
          <Chevron />
        </div>
      </button>

      <button onClick={openAchievements} style={card({ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", cursor: "pointer", textAlign: "left", width: "100%" })}>
        <div>
          <Eyebrow color={T.amber}>Achievements</Eyebrow>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginTop: 4 }}>
            Level {gamification.level} · {gamification.unlocked.length}/{ACHIEVEMENTS.length} unlocked
          </div>
        </div>
        <Chevron />
      </button>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={openTrainingLoad} style={card({ padding: 14, border: "none", cursor: "pointer", textAlign: "left", flex: 1 })}>
          <Eyebrow color={T.accent2}>Training Load</Eyebrow>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginTop: 6 }}>{trainingLoad.risk}</div>
        </button>
        <button onClick={openForm} style={card({ padding: 14, border: "none", cursor: "pointer", textAlign: "left", flex: 1 })}>
          <Eyebrow color={T.accent1}>Form</Eyebrow>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginTop: 6 }}>View gait data</div>
        </button>
        <button onClick={openDevices} style={card({ padding: 14, border: "none", cursor: "pointer", textAlign: "left", flex: 1 })}>
          <Eyebrow color={T.sub}>Devices</Eyebrow>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginTop: 6 }}>Fallback tier</div>
        </button>
      </div>

      <div style={card({ padding: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>This Week's Plan</div>
          <button
            onClick={onRegenerate}
            style={{ background: "none", border: "none", color: T.accent1, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}
          >
            Regenerate
          </button>
        </div>
        {aiLoading ? (
          <div style={{ fontSize: 13, color: T.sub, fontStyle: "italic" }}>Building your plan…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ai.weeklyPlan.map((d) => (
              <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, fontSize: 11, fontWeight: 700, color: T.sub }}>{d.day.toUpperCase()}</div>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    background: d.intensity === 0 ? "transparent" : dots[Math.min(3, d.intensity)],
                    border: d.intensity === 0 ? `1.5px solid ${T.hair}` : "none",
                    flexShrink: 0,
                  }}
                />
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{d.focus}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 14 }}>This Week</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
          {weekBars.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  borderRadius: 6,
                  height: `${Math.max(4, (v / maxBar) * 100)}%`,
                  background: i === TODAY_IDX ? T.accent1 : T.hair,
                }}
              />
              <div style={{ fontSize: 10, color: i === TODAY_IDX ? T.ink : T.sub, fontWeight: i === TODAY_IDX ? 700 : 400 }}>
                {DAY_LETTERS[i]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Live({ session, onLap, cues, paused, onTogglePause, onEndWorkout, started, onStart }) {
  const { elapsed, pace, speed, cadence, hr, laps, sprintIdx } = session;
  const cue = cues[Math.floor(elapsed / 8) % cues.length];

  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [showRpe, setShowRpe] = useState(false);
  const confirmTimeout = useRef(null);
  useEffect(() => () => clearTimeout(confirmTimeout.current), []);
  const handleEndPress = () => {
    if (!confirmingEnd) {
      setConfirmingEnd(true);
      confirmTimeout.current = setTimeout(() => setConfirmingEnd(false), 3000);
      return;
    }
    clearTimeout(confirmTimeout.current);
    setConfirmingEnd(false);
    setShowRpe(true);
  };
  const finishWithRpe = (rpe) => {
    setShowRpe(false);
    onEndWorkout(rpe);
  };

  if (showRpe) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <Eyebrow>Workout Complete</Eyebrow>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.ink, marginTop: 6 }}>How hard did that feel?</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>Rate your perceived effort, 1–10</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 8 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => finishWithRpe(n)}
              style={{
                aspectRatio: "1",
                borderRadius: 12,
                border: `1.5px solid ${T.hair}`,
                background: T.cardBg,
                color: T.ink,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.sub, padding: "0 2px" }}>
          <span>Very easy</span>
          <span>Max effort</span>
        </div>
        <button
          onClick={() => finishWithRpe(null)}
          style={{ background: "none", border: "none", color: T.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8 }}
        >
          Skip
        </button>
      </div>
    );
  }

  if (!started) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 60 }}>
        <Eyebrow color={T.sub}>Ready</Eyebrow>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.ink, textAlign: "center" }}>
          Start your run when you're ready
        </div>
        <div style={{ fontSize: 12, color: T.sub, textAlign: "center", maxWidth: 260 }}>
          Elapsed time, pace, and distance begin tracking the moment you tap Start.
        </div>
        <button
          onClick={onStart}
          style={{
            marginTop: 12,
            width: 140,
            height: 140,
            borderRadius: 999,
            border: "none",
            background: T.accent1,
            color: "#fff",
            fontWeight: 800,
            fontSize: 17,
            cursor: "pointer",
          }}
        >
          Start Run
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: paused ? T.amber : T.accent1 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.sub }}>{paused ? "Paused" : "Apple Watch Connected"}</span>
      </div>

      <div style={card({ padding: "10px 16px", fontSize: 13, fontStyle: "italic", color: T.ink, textAlign: "center" })}>
        "{cue}"
      </div>

      <BreathingGuide hr={hr} compact />

      <div style={{ textAlign: "center" }}>
        <Eyebrow color={T.sub}>Elapsed</Eyebrow>
        <div style={{ fontSize: 52, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
          {fmtClock(elapsed)}
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: T.accent1 }}>{(elapsed * 0.0028).toFixed(2)}</span>
          <span style={{ fontSize: 15, color: T.sub, marginLeft: 4 }}>mi</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard value={`${fmtPace(pace)} /mi`} label="Pace" />
        <StatCard value={`${speed.toFixed(1)} mph`} label="Speed" />
        <StatCard value={`${Math.round(cadence)} spm`} label="Cadence" />
        <StatCard value={`${Math.round(hr)} bpm`} label="Heart Rate" valueColor={T.red} />
        <StatCard value={estimateVO2(speed).toFixed(1)} label="Est. VO2 (ml/kg/min)" valueColor={T.accent2} />
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 10 }}>
          Sprint {sprintIdx} of {SPRINT_GOAL}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {Array.from({ length: SPRINT_GOAL }).map((_, i) => (
            <span key={i} style={{ width: 10, height: 10, borderRadius: 5, background: i < sprintIdx ? T.accent1 : T.hair }} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onLap}
          disabled={paused}
          style={{
            flex: 1,
            background: T.accent1,
            border: "none",
            borderRadius: 999,
            padding: "11px 0",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: paused ? "default" : "pointer",
            opacity: paused ? 0.5 : 1,
          }}
        >
          Lap
        </button>
        <button
          onClick={onTogglePause}
          style={{
            flex: 1,
            background: paused ? T.amber : "transparent",
            border: paused ? "none" : `1.5px solid ${T.hair}`,
            borderRadius: 999,
            padding: "11px 0",
            color: paused ? "#111214" : T.ink,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={handleEndPress}
          style={{
            flex: 1,
            background: confirmingEnd ? T.red : "transparent",
            border: `1.5px solid ${T.red}`,
            borderRadius: 999,
            padding: "11px 0",
            color: confirmingEnd ? "#fff" : T.red,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {confirmingEnd ? "Tap to Confirm" : "End Workout"}
        </button>
      </div>

      {laps.length > 0 && (
        <div style={card({ padding: 16 })}>
          {laps.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "9px 0",
                borderBottom: i < laps.length - 1 ? `1px solid ${T.hair}` : "none",
                fontSize: 13,
              }}
            >
              <span style={{ color: T.ink, fontWeight: 600 }}>Lap {i + 1}</span>
              <span style={{ color: T.sub }}>{fmtPace(l)} /mi</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Pace({ paceMinutes, sprintMinutes, vo2History, vo2Labels }) {
  const hasPace = paceMinutes.length > 0;
  const hasVO2 = vo2History.length > 0;
  const avg = hasPace ? paceMinutes.reduce((a, b) => a + b, 0) / paceMinutes.length : 0;
  const min = hasPace ? Math.min(...paceMinutes) : 0;
  const max = hasPace ? Math.max(...paceMinutes) : 0;
  const currentVO2 = hasVO2 ? vo2History[vo2History.length - 1] : null;
  const vo2Cat = hasVO2 ? vo2maxCategory(currentVO2) : null;
  const vo2Min = hasVO2 ? Math.min(...vo2History) : 0;
  const vo2Max = hasVO2 ? Math.max(...vo2History) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, color: T.sub }}>Average Pace</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: T.ink }}>
          {hasPace ? fmtPace(avg) : "—:—"} <span style={{ fontSize: 15, color: T.sub, fontWeight: 400 }}>/mi</span>
        </div>
      </div>

      <div style={card({ padding: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Eyebrow color={T.accent2}>VO2max Estimate</Eyebrow>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, marginTop: 4 }}>
              {hasVO2 ? currentVO2.toFixed(1) : "—"} <span style={{ fontSize: 13, color: T.sub, fontWeight: 400 }}>ml/kg/min</span>
            </div>
          </div>
          {vo2Cat && (
            <div style={{ fontSize: 12, fontWeight: 700, color: vo2Cat.color, padding: "5px 10px", borderRadius: 999, background: `${vo2Cat.color}1f` }}>
              {vo2Cat.label}
            </div>
          )}
        </div>
        {hasVO2 ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60, marginTop: 16 }}>
            {vo2History.map((v, i) => {
              const h = 25 + ((v - vo2Min) / (vo2Max - vo2Min || 1)) * 75;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ width: "100%", height: `${h}%`, borderRadius: 4, background: i === vo2History.length - 1 ? T.accent2 : T.hair }} />
                  <div style={{ fontSize: 8, color: T.sub }}>{vo2Labels[i]}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: T.sub, marginTop: 12 }}>Not enough runs yet to estimate VO2max.</div>
        )}
      </div>

      {hasPace ? (
        <>
          <div style={card({ padding: 16 })}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
              {paceMinutes.map((p, i) => {
                const h = 20 + ((max - p) / (max - min || 1)) * 80; // faster = taller
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ width: "100%", height: `${h}%`, borderRadius: 5, background: sprintMinutes.has(i) ? T.accent2 : T.accent1 }} />
                    <div style={{ fontSize: 9, color: T.sub }}>{i + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={card({ padding: "6px 16px" })}>
            {paceMinutes.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: i < paceMinutes.length - 1 ? `1px solid ${T.hair}` : "none",
                  fontSize: 13,
                }}
              >
                <span style={{ color: T.sub, fontWeight: 600 }}>Min {i + 1}</span>
                <span style={{ color: sprintMinutes.has(i) ? T.accent2 : T.ink, fontWeight: 700 }}>{fmtPace(p)} /mi</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={card({ padding: 16 })}>
          <div style={{ fontSize: 13, color: T.sub, textAlign: "center" }}>
            No pace data yet — complete a run to see your minute-by-minute splits here.
          </div>
        </div>
      )}
    </div>
  );
}

function History({ history, monthlyHistory }) {
  const [range, setRange] = useState("Weekly");
  // deltas: newest-first history → compare each run to the one before it (older)
  const deltas = history.slice(0, -1).map((w, i) => ({
    date: w.date,
    delta: w.pace - history[i + 1].pace, // negative = faster
  }));
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d.delta)), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>History</div>
        <div style={{ fontSize: 13, color: T.sub }}>Recent workouts</div>
      </div>

      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Pace Change, Day to Day</div>
        <div style={{ fontSize: 11, color: T.sub, marginBottom: 16 }}>vs. the previous run · faster ↑ slower ↓</div>
        {deltas.length === 0 ? (
          <div style={{ fontSize: 13, color: T.sub, textAlign: "center", padding: "30px 0" }}>
            Complete at least two runs to see how your pace is trending.
          </div>
        ) : (
        <div style={{ display: "flex", gap: 10, height: 130 }}>
          {[...deltas].reverse().map((d, i) => {
            const faster = d.delta < 0;
            const h = (Math.abs(d.delta) / maxAbs) * 42;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", position: "relative" }}>
                  <div style={{ position: "relative", width: "100%" }}>
                    {faster && (
                      <div style={{ position: "absolute", bottom: 1, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.accent1, marginBottom: 3 }}>{d.delta}s</div>
                        <div style={{ width: "70%", height: h, background: T.accent1, borderRadius: "5px 5px 0 0" }} />
                      </div>
                    )}
                    <div style={{ width: "100%", height: 2, background: T.hair }} />
                    {!faster && (
                      <div style={{ position: "absolute", top: 1, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: "70%", height: h, background: T.red, borderRadius: "0 0 5px 5px" }} />
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.red, marginTop: 3 }}>+{d.delta}s</div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: T.sub, marginTop: 6 }}>{d.date}</div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      <div style={{ display: "flex", background: T.bg, border: `1px solid ${T.hair}`, borderRadius: 999, padding: 3 }}>
        {["Weekly", "Monthly"].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background: range === r ? T.cardBg : "transparent",
              color: range === r ? T.ink : T.sub,
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <div style={card({ padding: "6px 16px" })}>
        {(range === "Weekly" ? history.length : monthlyHistory.length) === 0 ? (
          <div style={{ fontSize: 13, color: T.sub, textAlign: "center", padding: "20px 0" }}>
            No workouts logged yet. Finish a run to see it here.
          </div>
        ) : range === "Weekly"
          ? history.map((w, i) => {
              const prev = history[i + 1];
              const faster = prev ? w.pace < prev.pace : true;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "13px 0",
                    borderBottom: i < history.length - 1 ? `1px solid ${T.hair}` : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{w.date}</div>
                    <div style={{ fontSize: 12, color: T.sub }}>
                      {w.sprints} sprints · {w.distance}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{fmtPace(w.pace)} /mi</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: faster ? T.accent1 : T.sub }}>
                      {faster ? "↑ faster" : "↓ slower"}
                    </div>
                  </div>
                </div>
              );
            })
          : monthlyHistory.map((w, i) => {
              const prev = monthlyHistory[i + 1];
              const faster = prev ? w.avgPace < prev.avgPace : true;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "13px 0",
                    borderBottom: i < monthlyHistory.length - 1 ? `1px solid ${T.hair}` : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{w.period}</div>
                    <div style={{ fontSize: 12, color: T.sub }}>
                      {w.runs} runs · {w.distance}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{fmtPace(w.avgPace)} /mi avg</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: faster ? T.accent1 : T.sub }}>
                      {faster ? "↑ faster" : "↓ slower"}
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}

/* ───────── Core exercises ───────── */

function RoundBtn({ children, onClick, filled }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 36,
        height: 32,
        borderRadius: 10,
        border: `1px solid ${filled ? "transparent" : T.hair}`,
        background: filled ? T.accent1 : "transparent",
        color: filled ? "#fff" : T.ink,
        fontWeight: 700,
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function CoreExerciseRow({ ex, logged, isHolding, holdElapsed, onLogReps, onStartHold, onStopHold }) {
  const displayVal = ex.type === "hold" && isHolding ? holdElapsed : logged;
  const done = displayVal >= ex.target;
  return (
    <div style={card({ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 })}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{ex.name}</div>
          {done && <span style={{ fontSize: 10, fontWeight: 700, color: T.accent1 }}>✓ DONE</span>}
        </div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
          {displayVal}/{ex.target} {ex.unit}
        </div>
      </div>
      {ex.type === "reps" ? (
        <div style={{ display: "flex", gap: 6 }}>
          <RoundBtn onClick={() => onLogReps(ex.id, -5)}>−5</RoundBtn>
          <RoundBtn onClick={() => onLogReps(ex.id, 5)} filled>
            +5
          </RoundBtn>
        </div>
      ) : (
        <button
          onClick={() => (isHolding ? onStopHold(ex.id) : onStartHold(ex.id))}
          style={{
            background: isHolding ? T.red : T.accent1,
            border: "none",
            borderRadius: 999,
            padding: "10px 16px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {isHolding ? "Stop" : "Start"}
        </button>
      )}
    </div>
  );
}

function Core({ coreToday, coreCompleted, holdingId, holdElapsed, hr, onLogReps, onStartHold, onStopHold }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Core</div>
        <div style={{ fontSize: 13, color: T.sub }}>Today's core session</div>
      </div>

      <div style={card({ padding: 24 })}>
        <ProgressRing value={coreCompleted} goal={CORE_GOAL} unit="exercises" />
      </div>

      <BreathingGuide hr={hr} compact />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CORE_EXERCISES.map((ex) => (
          <CoreExerciseRow
            key={ex.id}
            ex={ex}
            logged={coreToday[ex.id] || 0}
            isHolding={holdingId === ex.id}
            holdElapsed={holdElapsed}
            onLogReps={onLogReps}
            onStartHold={onStartHold}
            onStopHold={onStopHold}
          />
        ))}
      </div>

      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Recent Sessions</div>
        {CORE_HISTORY.length === 0 && (
          <div style={{ fontSize: 13, color: T.sub }}>No core sessions yet — finish today's to start your history.</div>
        )}
        {CORE_HISTORY.map((h, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: i < CORE_HISTORY.length - 1 ? `1px solid ${T.hair}` : "none",
              fontSize: 13,
            }}
          >
            <span style={{ color: T.ink, fontWeight: 600 }}>{h.date}</span>
            <span style={{ color: T.sub }}>
              {h.completed}/{CORE_GOAL} · {h.totalReps} reps · {h.holdSec}s hold
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Coach({ ai, aiLoading }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>AI Coach</div>
        <div style={{ fontSize: 13, color: T.sub }}>Insights from your training</div>
      </div>
      {aiLoading ? (
        <div style={card({ padding: 20, fontSize: 13, color: T.sub, fontStyle: "italic" })}>
          Analyzing your workout…
        </div>
      ) : (
        <>
          <div style={card({ padding: 18 })}>
            <Eyebrow>Post-Workout</Eyebrow>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55, marginTop: 8 }}>{ai.postWorkoutInsight}</div>
          </div>
          <div style={card({ padding: 18 })}>
            <Eyebrow color={T.accent2}>This Week</Eyebrow>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55, marginTop: 8 }}>{ai.weeklyNarrative}</div>
          </div>
          <div style={card({ padding: 18 })}>
            <Eyebrow color={T.amber}>Core Strength</Eyebrow>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55, marginTop: 8 }}>{ai.coreInsight}</div>
          </div>
          <div style={card({ padding: 18 })}>
            <Eyebrow color={T.accent1}>Aerobic Fitness</Eyebrow>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55, marginTop: 8 }}>{ai.vo2maxNote}</div>
          </div>
        </>
      )}
    </div>
  );
}

function CycleScreen({ cycleDay, cycleLength, periodLength, onBack, onLogPeriod, onAdvanceDay, ai, aiLoading }) {
  const [expandedPhase, setExpandedPhase] = useState(null);
  const phase = phaseFor(cycleDay);
  const periodIn = cycleLength - cycleDay + 1;

  // July 2026 calendar: July 1 is a Wednesday, 31 days
  const firstDow = 3;
  const daysInMonth = 31;
  const today = 14;
  // map calendar day → cycle day (today == cycleDay)
  const cycleDayOf = (d) => {
    let cd = ((cycleDay + (d - today)) % cycleLength + cycleLength) % cycleLength;
    return cd === 0 ? cycleLength : cd;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Cycle Tracking" onBack={onBack} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
          Day {cycleDay} of {cycleLength} · {phase} phase
        </div>
        <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>Tap a phase for details</div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {Object.keys(PHASE_INFO).map((p) => {
          const active = expandedPhase === p;
          return (
            <button
              key={p}
              onClick={() => setExpandedPhase(active ? null : p)}
              style={{
                flex: 1,
                padding: "9px 2px",
                borderRadius: 999,
                border: `1px solid ${active ? T.accent1 : T.hair}`,
                background: active ? T.pillActiveBg : T.cardBg,
                color: active ? T.accent1 : p === phase ? T.ink : T.sub,
                fontSize: 10.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {expandedPhase && (
        <div style={card({ padding: 16 })}>
          <Eyebrow>{expandedPhase} · {PHASE_INFO[expandedPhase].range}</Eyebrow>
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, marginTop: 8 }}>{PHASE_INFO[expandedPhase].desc}</div>
          <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5, marginTop: 8 }}>{PHASE_INFO[expandedPhase].tip}</div>
        </div>
      )}

      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 12 }}>July 2026</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {DAY_LETTERS.map((d, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, color: T.sub, textAlign: "center", paddingBottom: 4 }}>
              {d}
            </div>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const cd = cycleDayOf(d);
            const isPeriod = cd <= periodLength;
            const isFertile = cd >= 12 && cd <= 16;
            const isToday = d === today;
            return (
              <div
                key={d}
                style={{
                  aspectRatio: "1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  borderRadius: 10,
                  background: isToday ? T.pillActiveBg : "transparent",
                  fontSize: 12,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? T.accent1 : T.ink,
                }}
              >
                {d}
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    background: isPeriod ? T.red : isFertile ? T.accent1 : "transparent",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div style={card({ padding: 16 })}>
        <Eyebrow color={T.red}>Next Period</Eyebrow>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 6 }}>In {periodIn} days</div>
      </div>

      <div style={card({ padding: 16 })}>
        <Eyebrow>Training Tip</Eyebrow>
        <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55, marginTop: 8 }}>
          {aiLoading ? <span style={{ color: T.sub, fontStyle: "italic" }}>Thinking…</span> : ai.cycleTip}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onLogPeriod}
          style={{ flex: 1, background: "transparent", border: `1.5px solid ${T.hair}`, borderRadius: 999, padding: "13px 0", color: T.ink, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          Log Period Start
        </button>
        <button
          onClick={onAdvanceDay}
          style={{ flex: 1, background: T.accent1, border: "none", borderRadius: 999, padding: "13px 0", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          +1 Day
        </button>
      </div>
    </div>
  );
}

function RecoveryScreen({ recovery, setRecovery, readiness, onBack }) {
  const { sleepHours, restingHR, soreness, stretchDone } = recovery;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Recovery" onBack={onBack} />

      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ fontSize: 52, fontWeight: 800, color: readinessColor(readiness), lineHeight: 1 }}>{readiness}</div>
        <div style={{ fontSize: 13, color: T.sub, marginTop: 6 }}>{readinessLabel(readiness)} readiness today</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard value={`${sleepHours} hr`} label="Sleep" />
        <StatCard value={`${restingHR} bpm`} label="Resting HR" />
      </div>

      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Muscle Soreness</div>
        <div style={{ display: "flex", gap: 8 }}>
          {["Low", "Moderate", "High"].map((s) => {
            const active = soreness === s;
            return (
              <button
                key={s}
                onClick={() => setRecovery((r) => ({ ...r, soreness: s }))}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 999,
                  border: `1px solid ${active ? T.accent1 : T.hair}`,
                  background: active ? T.pillActiveBg : "transparent",
                  color: active ? T.accent1 : T.sub,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => setRecovery((r) => ({ ...r, stretchDone: !r.stretchDone }))}
        style={card({
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: "none",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        })}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Stretching</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{stretchDone ? "Done" : "Not yet"}</div>
        </div>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            background: stretchDone ? T.accent1 : "transparent",
            border: stretchDone ? "none" : `2px solid ${T.hair}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {stretchDone && (
            <span style={{ width: 9, height: 5, borderLeft: "2.5px solid #fff", borderBottom: "2.5px solid #fff", transform: "rotate(-45deg) translate(1px,-1px)" }} />
          )}
        </div>
      </button>
    </div>
  );
}

function AchievementsScreen({ ctx, onBack }) {
  const { unlocked, unlockedIds, totalXP, level, xpIntoLevel } = computeGamification(ctx);
  const categories = [...new Set(ACHIEVEMENTS.map((a) => a.category))];
  const featured = unlocked.filter((a) => a.tier === "gold" || a.tier === "legendary");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Achievements" onBack={onBack} />

      <div style={card({ padding: 20 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Eyebrow>Level {level}</Eyebrow>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, marginTop: 4 }}>{totalXP} XP</div>
          </div>
          <div style={{ fontSize: 13, color: T.sub, textAlign: "right" }}>
            {unlocked.length}/{ACHIEVEMENTS.length}
            <br />
            unlocked
          </div>
        </div>
        <div style={{ height: 6, background: T.hair, borderRadius: 3, marginTop: 14, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${xpIntoLevel}%`,
              background: `linear-gradient(90deg, ${T.accent1}, ${T.accent2})`,
              borderRadius: 3,
            }}
          />
        </div>
        <div style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
          {xpIntoLevel}/100 XP to Level {level + 1}
        </div>
      </div>

      {featured.length > 0 && (
        <div>
          <Eyebrow color={T.amber}>Trophy Case</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {featured.map((a) => (
              <AchievementBadge key={a.id} achievement={a} unlocked ctx={ctx} onClick={() => {}} />
            ))}
          </div>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat}>
          <Eyebrow>{cat}</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => (
              <AchievementBadge key={a.id} achievement={a} unlocked={unlockedIds.has(a.id)} ctx={ctx} onClick={() => {}} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrainingLoadScreen({ readiness, rpeLog, history, confidenceScore, onBack }) {
  const acwr = computeACWR(history);
  const { risk, riskColor } = acwr;
  const confidence = confidenceBreakdown(history);
  const lastRun = history[0];
  const avgPace = history.length ? history.reduce((s, w) => s + w.pace, 0) / history.length : 0;
  const vsBaseline = lastRun ? lastRun.pace - avgPace : 0; // negative = faster than your baseline
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Training Load" onBack={onBack} />

      <div style={card({ padding: 18 })}>
        <Eyebrow>Acute:Chronic Workload Ratio</Eyebrow>
        {acwr.hasData ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: T.ink }}>{acwr.ratio}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: riskColor }}>{risk}</div>
            </div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}>
              Acute (recent 3 runs): ~{acwr.acute} · Chronic (all logged runs): ~{acwr.chronic} relative-effort units
            </div>
            <div style={{ fontSize: 11, color: T.sub, marginTop: 8, fontStyle: "italic" }}>
              Estimated from pace/distance — not a substitute for how your body actually feels.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: T.sub, marginTop: 8 }}>
            Log a few runs to see your acute:chronic workload ratio here.
          </div>
        )}
      </div>

      {lastRun ? (
        <div style={{ display: "flex", gap: 10 }}>
          <StatCard value={`${estimateTSS(lastRun)}`} label="Last Run Effort (est.)" />
          <StatCard
            value={`${vsBaseline <= 0 ? "−" : "+"}${Math.abs(Math.round(vsBaseline))}s`}
            label="vs. Your Baseline"
            valueColor={vsBaseline <= 0 ? T.accent1 : T.red}
          />
        </div>
      ) : (
        <div style={card({ padding: 16 })}>
          <div style={{ fontSize: 13, color: T.sub }}>No runs logged yet — complete a workout to see your effort here.</div>
        </div>
      )}

      <div style={card({ padding: 18 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow color={T.accent2}>Data Confidence</Eyebrow>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.accent2 }}>{history.length ? confidenceScore : "—"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {confidence.map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: T.sub }}>{row.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: row.good ? T.accent1 : T.ink }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card({ padding: 18 })}>
        <Eyebrow>Perceived Effort Log</Eyebrow>
        {rpeLog.length === 0 ? (
          <div style={{ fontSize: 12, color: T.sub, marginTop: 8 }}>
            Rate your effort (1–10) when you end a workout to build this log.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {rpeLog.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: T.ink }}>RPE {r.rpe} · {RPE_LABELS[r.rpe] || ""}</span>
                <span style={{ color: T.sub }}>{r.hr} bpm avg</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FormScreen({ session, onBack }) {
  const { cadence, hr } = session;
  // Illustrative gait metrics derived from simulated cadence — phone-only fallback tier,
  // not a real accelerometer-based strike classifier (needs labeled ground-truth data; see spec).
  const groundContactMs = Math.round(240 - (cadence - 172) * 1.4);
  const verticalOscCm = Math.round((9.2 - (cadence - 172) * 0.03) * 10) / 10;
  const strikePattern = cadence > 175 ? "Midfoot" : cadence > 168 ? "Heel" : "Forefoot";
  const symmetryPct = 96 + Math.round(Math.sin(hr / 7) * 3);
  const formScore = Math.max(0, Math.min(100, Math.round(72 + (cadence - 172) * 1.8 - Math.abs(100 - symmetryPct) * 2)));
  const fatigueCurve = [100, 98, 95, 93, 88, 84]; // % of starting cadence, by km — illustrative
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Form" onBack={onBack} />

      <div style={card({ padding: 20, textAlign: "center" })}>
        <Eyebrow>Form Score</Eyebrow>
        <div style={{ fontSize: 44, fontWeight: 800, color: T.ink, marginTop: 6 }}>{formScore}</div>
        <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>Fallback tier (phone-only) · estimated, not diagnostic</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard value={strikePattern} label="Strike Pattern" />
        <StatCard value={`${symmetryPct}%`} label="L/R Symmetry" />
        <StatCard value={`${groundContactMs} ms`} label="Ground Contact" />
        <StatCard value={`${verticalOscCm} cm`} label="Vertical Oscillation" />
      </div>

      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Cadence Fatigue Curve</div>
        <div style={{ fontSize: 11, color: T.sub, marginBottom: 14 }}>% of starting cadence, by kilometer this run</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
          {fatigueCurve.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ width: "100%", height: `${v}%`, borderRadius: 4, background: v < 90 ? T.amber : T.accent1 }} />
              <div style={{ fontSize: 9, color: T.sub }}>{i + 1}k</div>
            </div>
          ))}
        </div>
        {fatigueCurve[fatigueCurve.length - 1] < 90 && (
          <div style={{ fontSize: 12, color: T.amber, marginTop: 12 }}>
            Cadence dropped {100 - fatigueCurve[fatigueCurve.length - 1]}% by the final kilometer — a common late-run fatigue signature.
          </div>
        )}
      </div>

      <div style={card({ padding: 16 })}>
        <Eyebrow color={T.red}>About These Numbers</Eyebrow>
        <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.55, marginTop: 8 }}>
          Strike pattern and symmetry are unreliable from a pocketed phone — arm swing and phone placement dominate the
          signal. For validated running-dynamics data, connect a Garmin Running Dynamics Pod, Stryd, or an Apple Watch
          SE/Series 6+ in Devices.
        </div>
      </div>
    </div>
  );
}

const DEVICE_TIERS = [
  {
    tier: "Best",
    color: T.accent1,
    sources: "Garmin Running Dynamics Pod, Stryd foot pod",
    metrics: "Ground contact time, vertical oscillation, strike pattern — validated against force-plate research",
    action: "Connect via Garmin/Stryd API",
    status: "needs-key",
  },
  {
    tier: "Good",
    color: T.accent2,
    sources: "Apple Watch SE / Series 6+",
    metrics: "Ground contact time, vertical oscillation, stride length via HealthKit running dynamics",
    action: "Requires a native watchOS companion app",
    status: "needs-native",
  },
  {
    tier: "Fallback",
    color: T.sub,
    sources: "This phone, pocket or armband",
    metrics: "Cadence is reliable; strike pattern and symmetry are not — arm swing dominates the signal",
    action: "Active now",
    status: "active",
  },
];

function DevicesScreen({ onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Devices" onBack={onBack} />
      <div style={{ fontSize: 13, color: T.sub }}>
        Every metric in this app is only as good as its source. Here's exactly what's powering yours.
      </div>

      {DEVICE_TIERS.map((d) => (
        <div key={d.tier} style={card({ padding: 18, borderLeft: `3px solid ${d.color}` })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Eyebrow color={d.color}>{d.tier} Tier</Eyebrow>
            {d.status === "active" && (
              <span style={{ fontSize: 10, fontWeight: 700, color: T.accent1, border: `1px solid ${T.accent1}`, borderRadius: 999, padding: "2px 8px" }}>
                ACTIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginTop: 8 }}>{d.sources}</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>{d.metrics}</div>
          <button
            disabled={d.status !== "active"}
            style={{
              marginTop: 14,
              background: d.status === "active" ? T.hair : "transparent",
              border: d.status === "active" ? "none" : `1.5px solid ${T.hair}`,
              borderRadius: 999,
              padding: "10px 16px",
              color: d.status === "active" ? T.sub : d.color,
              fontWeight: 700,
              fontSize: 12,
              cursor: d.status === "active" ? "default" : "not-allowed",
            }}
          >
            {d.action}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ───────── Tab bar ───────── */

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "live", label: "Live" },
  { id: "core", label: "Core" },
  { id: "pace", label: "Pace" },
  { id: "history", label: "History" },
  { id: "coach", label: "Coach" },
];

function TabIcon({ id, color }) {
  const s = 15;
  switch (id) {
    case "summary":
      return <span style={{ width: s, height: s, borderRadius: "50%", border: `2px solid ${color}`, display: "block", boxSizing: "border-box" }} />;
    case "live":
      return (
        <span
          style={{
            width: 0,
            height: 0,
            borderTop: "7px solid transparent",
            borderBottom: "7px solid transparent",
            borderLeft: `11px solid ${color}`,
            display: "block",
          }}
        />
      );
    case "pace":
      return (
        <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: s }}>
          <span style={{ width: 3, height: 7, background: color, borderRadius: 1 }} />
          <span style={{ width: 3, height: 12, background: color, borderRadius: 1 }} />
          <span style={{ width: 3, height: 9, background: color, borderRadius: 1 }} />
        </span>
      );
    case "core":
      return (
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ width: 14, height: 2.5, background: color, borderRadius: 1, display: "block" }} />
          <span style={{ width: 14, height: 2.5, background: color, borderRadius: 1, display: "block" }} />
          <span style={{ width: 14, height: 2.5, background: color, borderRadius: 1, display: "block" }} />
        </span>
      );
    case "history":
      return (
        <span style={{ width: s, height: s, borderRadius: "50%", border: `2px solid ${color}`, position: "relative", display: "block", boxSizing: "border-box" }}>
          <span style={{ position: "absolute", left: "45%", top: 2, width: 2, height: 5, background: color }} />
          <span style={{ position: "absolute", left: "45%", top: "42%", width: 5, height: 2, background: color }} />
        </span>
      );
    case "coach":
      return <span style={{ width: 11, height: 11, background: color, transform: "rotate(45deg)", display: "block", borderRadius: 2 }} />;
    default:
      return null;
  }
}

function TabBar({ active, setActive }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        bottom: 14,
        borderRadius: 26,
        background: "rgba(27,29,32,0.72)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: `1px solid ${T.hair}`,
        boxShadow: T.shadow,
        display: "flex",
        padding: 6,
        zIndex: 20,
      }}
    >
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "8px 0 6px",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              background: on ? T.pillActiveBg : "transparent",
            }}
          >
            <TabIcon id={t.id} color={on ? T.accent1 : T.sub} />
            <span style={{ fontSize: 10, fontWeight: on ? 700 : 500, color: on ? T.accent1 : T.sub }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────── App ───────── */

export default function App() {
  const [authState, setAuthState] = useState("splash"); // splash | login | app
  const [activeTab, setActiveTab] = useState("summary");

  // Supabase auth: resolve the current session once, then react to sign-in/out.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuthState(data.session ? "app" : "login");
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthState(session ? "app" : "login");
      if (event === "SIGNED_IN") {
        setSession({ elapsed: 0, pace: 0, speed: 0, cadence: 0, hr: 68, laps: [], sprintIdx: 0 });
        setSessionPaused(false);
        setSessionStarted(false);
        setRuns([]);
        fetchRuns();
      }
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const onSignIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const onSignUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };
    return { needsConfirmation: !data.session };
  }, []);

  const onSignOut = useCallback(() => {
    supabase.auth.signOut();
  }, []);

  // Persisted runs (see supabase/migrations) — fetched per signed-in user, drives
  // History/Pace/Achievements/Training Load instead of static mock arrays.
  const [runs, setRuns] = useState([]);
  const fetchRuns = useCallback(async () => {
    const { data, error } = await supabase.from("runs").select("*").order("created_at", { ascending: false });
    if (!error && data) setRuns(data);
    else if (error) console.error("Failed to load runs:", error);
  }, []);
  useEffect(() => {
    if (authState === "app") fetchRuns();
  }, [authState, fetchRuns]);

  const history = useMemo(() => deriveHistory(runs), [runs]);
  const monthlyHistory = useMemo(() => deriveMonthlyHistory(runs), [runs]);
  const vo2History = useMemo(() => deriveVO2MaxHistory(runs), [runs]);
  const vo2Labels = useMemo(() => deriveVO2MaxLabels(runs), [runs]);
  const streaks = useMemo(() => deriveStreaks(runs), [runs]);
  const confidenceScore = useMemo(() => deriveConfidence(runs), [runs]);
  const todayStats = useMemo(() => deriveTodayStats(runs), [runs]);
  const weekBars = useMemo(() => deriveWeekBars(runs), [runs]);
  const latestRun = history[0];

  const [cyclePresented, setCyclePresented] = useState(false);
  const [recoveryPresented, setRecoveryPresented] = useState(false);
  const [achievementsPresented, setAchievementsPresented] = useState(false);
  const [trainingLoadPresented, setTrainingLoadPresented] = useState(false);
  const [formPresented, setFormPresented] = useState(false);
  const [devicesPresented, setDevicesPresented] = useState(false);

  const [cycleDay, setCycleDay] = useState(1);
  const cycleLength = 28;
  const periodLength = 5;

  const [recovery, setRecovery] = useState({ sleepHours: 7.4, restingHR: 54, soreness: "Low", stretchDone: false });
  const readiness = useMemo(() => {
    const sorenessPenalty = { Low: 0, Moderate: 15, High: 30 }[recovery.soreness];
    const sleepPenalty = recovery.sleepHours < 7 ? Math.round((7 - recovery.sleepHours) * 8) : 0;
    const stretchBonus = recovery.stretchDone ? 8 : 0;
    return Math.max(10, Math.min(100, 100 - sorenessPenalty - sleepPenalty + stretchBonus));
  }, [recovery]);

  // core exercise tracking
  const [coreToday, setCoreToday] = useState({});
  const [holdingId, setHoldingId] = useState(null);
  const [holdElapsed, setHoldElapsed] = useState(0);
  const [coreHr, setCoreHr] = useState(96);
  const coreCompleted = useMemo(
    () => CORE_EXERCISES.filter((ex) => (ex.id === holdingId ? holdElapsed : coreToday[ex.id] || 0) >= ex.target).length,
    [coreToday, holdingId, holdElapsed]
  );
  useEffect(() => {
    if (!holdingId) return;
    const id = setInterval(() => {
      setHoldElapsed((e) => e + 1);
      setCoreHr((h) => Math.min(165, h + Math.random() * 3 - 0.5));
    }, 1000);
    return () => clearInterval(id);
  }, [holdingId]);
  const onLogReps = useCallback((id, delta) => {
    setCoreToday((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }));
  }, []);
  const onStartHold = useCallback((id) => {
    setHoldingId(id);
    setHoldElapsed(0);
  }, []);
  const onStopHold = useCallback(
    (id) => {
      setCoreToday((c) => ({ ...c, [id]: Math.max(c[id] || 0, holdElapsed) }));
      setHoldingId(null);
      setCoreHr(96);
    },
    [holdElapsed]
  );

  // live session simulation
  const [session, setSession] = useState({
    elapsed: 0,
    pace: 0,
    speed: 0,
    cadence: 0,
    hr: 68,
    laps: [],
    sprintIdx: 0,
  });
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const onStartRun = useCallback(() => setSessionStarted(true), []);
  const onTogglePause = useCallback(() => setSessionPaused((p) => !p), []);
  // Minute-by-minute pace samples + sprint-effort minute flags, captured live so a
  // completed run can persist real Pace-screen splits instead of nothing.
  const minuteLogRef = useRef([]);
  const sprintMinutesRef = useRef(new Set());
  useEffect(() => {
    if (authState !== "app" || !sessionStarted || sessionPaused) return;
    const id = setInterval(() => {
      setSession((s) => {
        const t = s.elapsed + 1;
        // Warm-up build-up: HR/pace/speed/cadence climb from resting toward steady
        // effort (~zone 4) instead of jumping straight to threshold on tick one.
        const warmup = 1 - Math.exp(-t / 45);
        const pace = 600 + (415 - 600) * warmup + Math.sin(t / 9) * 28 * warmup;
        if (t % 60 === 0 && minuteLogRef.current.length < t / 60) {
          minuteLogRef.current.push(Math.round(pace));
        }
        return {
          ...s,
          elapsed: t,
          pace,
          speed: 3 + (8.6 - 3) * warmup + Math.sin(t / 7) * 1.4 * warmup,
          cadence: 140 + (172 - 140) * warmup + Math.sin(t / 11) * 6 * warmup,
          hr: 68 + (158 - 68) * warmup + Math.sin(t / 13) * 9 * warmup,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [authState, sessionStarted, sessionPaused]);
  const onLap = useCallback(() => {
    setSession((s) => {
      sprintMinutesRef.current.add(Math.floor(s.elapsed / 60));
      return {
        ...s,
        laps: [...s.laps, 380 + Math.random() * 70],
        sprintIdx: Math.min(SPRINT_GOAL, s.sprintIdx + 1),
      };
    });
  }, []);
  const [rpeLog, setRpeLog] = useState([]);
  const onEndWorkout = useCallback(
    async (rpe) => {
      if (rpe != null) {
        setRpeLog((log) => [{ rpe, hr: Math.round(session.hr) }, ...log].slice(0, 10));
      }
      const distanceMi = Math.round(session.elapsed * 0.0028 * 100) / 100;
      if (session.elapsed > 0 && distanceMi > 0) {
        const { data, error } = await supabase
          .from("runs")
          .insert({
            distance_mi: distanceMi,
            duration_sec: session.elapsed,
            avg_pace_sec: Math.round(session.elapsed / distanceMi),
            sprints: session.sprintIdx,
            avg_hr: Math.round(session.hr),
            avg_cadence: Math.round(session.cadence),
            rpe: rpe ?? null,
            vo2max: Math.round(estimateVO2(session.speed) * 10) / 10,
            pace_minutes: minuteLogRef.current,
            sprint_minutes: Array.from(sprintMinutesRef.current),
          })
          .select()
          .single();
        if (!error && data) setRuns((r) => [data, ...r]);
        else if (error) console.error("Failed to save run:", error);
      }
      minuteLogRef.current = [];
      sprintMinutesRef.current = new Set();
      setSession({ elapsed: 0, pace: 0, speed: 0, cadence: 0, hr: 68, laps: [], sprintIdx: 0 });
      setSessionPaused(false);
      setSessionStarted(false);
      setActiveTab("summary");
    },
    [session]
  );

  // AI: single call returning all 5 outputs
  const [ai, setAi] = useState(FALLBACK_AI);
  const [aiLoading, setAiLoading] = useState(true);
  const fetchAi = useCallback(async () => {
    setAiLoading(true);
    try {
      const runsContext =
        history.length > 0
          ? `Recent runs (newest first, avg pace): ${history.map((w) => fmtPace(w.pace)).join(", ")}.`
          : "This athlete has no logged runs yet — they're brand new to the app.";
      const coreContext =
        CORE_HISTORY.length > 0
          ? `Recent core sessions completed: ${CORE_HISTORY.map((h) => `${h.completed}/${CORE_GOAL}`).join(", ")}.`
          : "No core sessions logged yet.";
      const vo2Context =
        vo2History.length > 0
          ? `VO2max estimate trend (ml/kg/min): ${vo2History.join(", ")}.`
          : "No VO2max estimate yet — not enough runs logged.";

      const prompt = `You are the AI coach inside "Stride", a sprint, core-strength, and running app. Given this athlete context, respond with ONLY strict JSON (no markdown fences, no preamble) matching exactly this shape:
{"postWorkoutInsight": string, "weeklyNarrative": string, "liveCues": string[5], "cycleTip": string, "coreInsight": string, "vo2maxNote": string, "weeklyPlan": [{"day": "Mon".."Sun", "focus": string, "intensity": 0|1|2|3}] (7 entries)}

Context:
- ${runsContext}
- Menstrual cycle: day ${cycleDay} of ${cycleLength} (${phaseFor(cycleDay)} phase). Make cycleTip phase-aware.
- ${coreContext}
- ${vo2Context}
- Breathing technique is HR-zone based (box breathing at rest up through 1:1 breathing near max effort); reference it only if natural.
- If there's no history yet, keep postWorkoutInsight/weeklyNarrative/coreInsight/vo2maxNote short, welcoming, and forward-looking (what they'll see once they log a workout) rather than inventing numbers. Otherwise: postWorkoutInsight 1–2 sentences referencing a specific run, weeklyNarrative 1–2 sentences on the trend, coreInsight 1–2 sentences with a concrete target, vo2maxNote 1–2 sentences on the trend. liveCues: 5 short motivational mid-sprint voice cues (always). weeklyPlan: a beginner-friendly first week if no history, otherwise tailored to their trend; focus text short (≤5 words).`;

      const { data, error } = await supabase.functions.invoke("ai-coach", { body: { prompt } });
      if (error) throw error;
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (parsed && parsed.weeklyPlan && parsed.liveCues) setAi(parsed);
    } catch (e) {
      console.error("AI call failed, using fallback content:", e);
      setAi(FALLBACK_AI);
    } finally {
      setAiLoading(false);
    }
  }, [cycleDay, history, vo2History]);
  useEffect(() => {
    if (authState === "app") fetchAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  const cues = aiLoading ? FALLBACK_AI.liveCues : ai.liveCues;

  let body;
  if (authState === "splash") body = <Splash />;
  else if (authState === "login") body = <Login onSignIn={onSignIn} onSignUp={onSignUp} />;
  else if (cyclePresented)
    body = (
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px" }}>
        <CycleScreen
          cycleDay={cycleDay}
          cycleLength={cycleLength}
          periodLength={periodLength}
          onBack={() => setCyclePresented(false)}
          onLogPeriod={() => setCycleDay(1)}
          onAdvanceDay={() => setCycleDay((d) => (d % cycleLength) + 1)}
          ai={ai}
          aiLoading={aiLoading}
        />
      </div>
    );
  else if (recoveryPresented)
    body = (
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px" }}>
        <RecoveryScreen recovery={recovery} setRecovery={setRecovery} readiness={readiness} onBack={() => setRecoveryPresented(false)} />
      </div>
    );
  else if (achievementsPresented)
    body = (
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px" }}>
        <AchievementsScreen
          ctx={achievementContext({ readiness, coreCompleted, history, streaks, confidence: confidenceScore })}
          onBack={() => setAchievementsPresented(false)}
        />
      </div>
    );
  else if (trainingLoadPresented)
    body = (
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px" }}>
        <TrainingLoadScreen
          readiness={readiness}
          rpeLog={rpeLog}
          history={history}
          confidenceScore={confidenceScore}
          onBack={() => setTrainingLoadPresented(false)}
        />
      </div>
    );
  else if (formPresented)
    body = (
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px" }}>
        <FormScreen session={session} onBack={() => setFormPresented(false)} />
      </div>
    );
  else if (devicesPresented)
    body = (
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px" }}>
        <DevicesScreen onBack={() => setDevicesPresented(false)} />
      </div>
    );
  else
    body = (
      <>
        <div style={{ flex: 1, overflowY: "auto", padding: "56px 18px 110px" }}>
          {activeTab === "summary" && (
            <Summary
              ai={ai}
              aiLoading={aiLoading}
              onRegenerate={fetchAi}
              readiness={readiness}
              cycleDay={cycleDay}
              cycleLength={cycleLength}
              openCycle={() => setCyclePresented(true)}
              openRecovery={() => setRecoveryPresented(true)}
              openAchievements={() => setAchievementsPresented(true)}
              openTrainingLoad={() => setTrainingLoadPresented(true)}
              openForm={() => setFormPresented(true)}
              openDevices={() => setDevicesPresented(true)}
              achievementCtx={achievementContext({ readiness, coreCompleted, history, streaks, confidence: confidenceScore })}
              history={history}
              todayStats={todayStats}
              weekBars={weekBars}
              onSignOut={onSignOut}
            />
          )}
          {activeTab === "live" && (
            <Live
              session={session}
              onLap={onLap}
              cues={cues}
              paused={sessionPaused}
              onTogglePause={onTogglePause}
              onEndWorkout={onEndWorkout}
              started={sessionStarted}
              onStart={onStartRun}
            />
          )}
          {activeTab === "core" && (
            <Core
              coreToday={coreToday}
              coreCompleted={coreCompleted}
              holdingId={holdingId}
              holdElapsed={holdElapsed}
              hr={holdingId ? coreHr : 88}
              onLogReps={onLogReps}
              onStartHold={onStartHold}
              onStopHold={onStopHold}
            />
          )}
          {activeTab === "pace" && (
            <Pace
              paceMinutes={latestRun?.paceMinutes || []}
              sprintMinutes={latestRun?.sprintMinutes || new Set()}
              vo2History={vo2History}
              vo2Labels={vo2Labels}
            />
          )}
          {activeTab === "history" && <History history={history} monthlyHistory={monthlyHistory} />}
          {activeTab === "coach" && <Coach ai={ai} aiLoading={aiLoading} />}
        </div>
        <TabBar active={activeTab} setActive={setActiveTab} />
      </>
    );

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div
        style={{
          width: 390,
          height: 800,
          maxHeight: "95vh",
          background: T.bg,
          borderRadius: 40,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
          border: "1px solid #26282c",
        }}
      >
        <style>{`
          @keyframes breathePulse { 0%, 100% { transform: scale(0.65); opacity: 0.5; } 50% { transform: scale(1); opacity: 1; } }
          @keyframes legSwingFront { 0%, 100% { transform: rotate(-30deg); } 50% { transform: rotate(30deg); } }
          @keyframes legSwingBack { 0%, 100% { transform: rotate(30deg); } 50% { transform: rotate(-30deg); } }
        `}</style>
        {body}
      </div>
    </div>
  );
}

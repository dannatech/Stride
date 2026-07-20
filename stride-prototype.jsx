import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ─────────────────────────────────────────────
   Stride — Sprint & Stride Tracking Prototype
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

/* ───────── sample data (wire to HealthKit in production) ───────── */

const SPRINTS_TODAY = 8;
const SPRINT_GOAL = 10;
const WEEK_BARS = [6, 9, 4, 10, 7, 0, 8]; // Su..Sa, today = index 2 (Tue)
const TODAY_IDX = 2;
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const HISTORY = [
  { date: "Jul 14", sprints: 8, distance: "3.2 mi", pace: 412 },
  { date: "Jul 12", sprints: 10, distance: "3.8 mi", pace: 425 },
  { date: "Jul 10", sprints: 7, distance: "2.9 mi", pace: 418 },
  { date: "Jul 8", sprints: 9, distance: "3.5 mi", pace: 436 },
  { date: "Jul 6", sprints: 6, distance: "2.6 mi", pace: 431 },
  { date: "Jul 4", sprints: 8, distance: "3.1 mi", pace: 447 },
]; // pace in seconds per mile, newest first

const PACE_MINUTES = [462, 448, 431, 395, 418, 442, 388, 402, 455, 391, 424, 438];
const SPRINT_MINUTES = new Set([3, 6, 9]); // zero-indexed sprint-effort minutes

const FALLBACK_AI = {
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

/* ───────── Sprint ring ───────── */

function SprintRing({ value, goal }) {
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
        <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>of {goal} sprints</div>
      </div>
    </div>
  );
}

/* ───────── Screens ───────── */

function Splash() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Logomark />
      <div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>Stride</div>
    </div>
  );
}

function Login({ onLogin }) {
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
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginBottom: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <Logomark size={56} radius={18} fontSize={24} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>Welcome back</div>
        <div style={{ fontSize: 13, color: T.sub }}>Track sprints, strides and recovery</div>
      </div>
      <input style={field} placeholder="Email" />
      <input style={field} placeholder="Password" type="password" />
      <button
        onClick={onLogin}
        style={{
          background: T.accent1,
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          border: "none",
          borderRadius: 999,
          padding: "15px 0",
          cursor: "pointer",
          marginTop: 4,
        }}
      >
        Log In
      </button>
      <button
        onClick={onLogin}
        style={{
          background: "transparent",
          color: T.ink,
          fontWeight: 600,
          fontSize: 15,
          border: `1.5px solid ${T.hair}`,
          borderRadius: 999,
          padding: "14px 0",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span style={{ width: 12, height: 12, background: T.ink, borderRadius: 3, display: "inline-block" }} />
        Continue with Apple
      </button>
      <div style={{ fontSize: 13, color: T.sub, textAlign: "center", marginTop: 8 }}>
        Don't have an account?{" "}
        <span style={{ color: T.accent1, fontWeight: 600, cursor: "pointer" }}>Sign up</span>
      </div>
    </div>
  );
}

function Summary({ ai, aiLoading, onRegenerate, readiness, cycleDay, cycleLength, openCycle, openRecovery }) {
  const phase = phaseFor(cycleDay);
  const periodIn = cycleLength - cycleDay + 1;
  const maxBar = Math.max(...WEEK_BARS, 1);
  const dots = ["", T.sub, T.accent2, T.accent1]; // intensity 0..3
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, color: T.sub }}>Tuesday, July 14</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Good morning</div>
      </div>

      <div style={card({ padding: 24 })}>
        <SprintRing value={SPRINTS_TODAY} goal={SPRINT_GOAL} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <StatCard value="17.4 mph" label="Max Speed" />
        <StatCard value="3.2 mi" label="Distance" />
        <StatCard value="32:08" label="Duration" />
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
          {WEEK_BARS.map((v, i) => (
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

function Live({ session, onLap, cues }) {
  const { elapsed, pace, speed, cadence, hr, laps, sprintIdx } = session;
  const cue = cues[Math.floor(elapsed / 8) % cues.length];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: T.accent1 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.sub }}>Apple Watch Connected</span>
      </div>

      <div style={card({ padding: "10px 16px", fontSize: 13, fontStyle: "italic", color: T.ink, textAlign: "center" })}>
        "{cue}"
      </div>

      <div style={{ textAlign: "center" }}>
        <Eyebrow color={T.sub}>Elapsed</Eyebrow>
        <div style={{ fontSize: 52, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
          {fmtClock(elapsed)}
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: T.accent1 }}>{fmtPace(pace)}</span>
          <span style={{ fontSize: 15, color: T.sub, marginLeft: 4 }}>/mi</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard value={`${(elapsed * 0.0028 + 0.4).toFixed(2)} mi`} label="Distance" />
        <StatCard value={`${speed.toFixed(1)} mph`} label="Speed" />
        <StatCard value={`${Math.round(cadence)} spm`} label="Cadence" />
        <StatCard value={`${Math.round(hr)} bpm`} label="Heart Rate" valueColor={T.red} />
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

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onLap}
          style={{ flex: 1, background: T.accent1, border: "none", borderRadius: 999, padding: "14px 0", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
        >
          Lap
        </button>
        <button
          style={{ flex: 1, background: "transparent", border: `1.5px solid ${T.hair}`, borderRadius: 999, padding: "14px 0", color: T.ink, fontWeight: 700, fontSize: 15, cursor: "pointer" }}
        >
          Pause
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

function Pace() {
  const avg = PACE_MINUTES.reduce((a, b) => a + b, 0) / PACE_MINUTES.length;
  const min = Math.min(...PACE_MINUTES);
  const max = Math.max(...PACE_MINUTES);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, color: T.sub }}>Average Pace</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: T.ink }}>
          {fmtPace(avg)} <span style={{ fontSize: 15, color: T.sub, fontWeight: 400 }}>/mi</span>
        </div>
      </div>

      <div style={card({ padding: 16 })}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
          {PACE_MINUTES.map((p, i) => {
            const h = 20 + ((max - p) / (max - min)) * 80; // faster = taller
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ width: "100%", height: `${h}%`, borderRadius: 5, background: SPRINT_MINUTES.has(i) ? T.accent2 : T.accent1 }} />
                <div style={{ fontSize: 9, color: T.sub }}>{i + 1}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={card({ padding: "6px 16px" })}>
        {PACE_MINUTES.map((p, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: i < PACE_MINUTES.length - 1 ? `1px solid ${T.hair}` : "none",
              fontSize: 13,
            }}
          >
            <span style={{ color: T.sub, fontWeight: 600 }}>Min {i + 1}</span>
            <span style={{ color: SPRINT_MINUTES.has(i) ? T.accent2 : T.ink, fontWeight: 700 }}>{fmtPace(p)} /mi</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function History() {
  const [range, setRange] = useState("Weekly");
  // deltas: newest-first history → compare each run to the one before it (older)
  const deltas = HISTORY.slice(0, -1).map((w, i) => ({
    date: w.date,
    delta: w.pace - HISTORY[i + 1].pace, // negative = faster
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
        {HISTORY.map((w, i) => {
          const prev = HISTORY[i + 1];
          const faster = prev ? w.pace < prev.pace : true;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "13px 0",
                borderBottom: i < HISTORY.length - 1 ? `1px solid ${T.hair}` : "none",
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
        })}
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

/* ───────── Tab bar ───────── */

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "live", label: "Live" },
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
  const [cyclePresented, setCyclePresented] = useState(false);
  const [recoveryPresented, setRecoveryPresented] = useState(false);

  const [cycleDay, setCycleDay] = useState(9);
  const cycleLength = 28;
  const periodLength = 5;

  const [recovery, setRecovery] = useState({ sleepHours: 7.4, restingHR: 54, soreness: "Low", stretchDone: false });
  const readiness = useMemo(() => {
    const sorenessPenalty = { Low: 0, Moderate: 15, High: 30 }[recovery.soreness];
    const sleepPenalty = recovery.sleepHours < 7 ? Math.round((7 - recovery.sleepHours) * 8) : 0;
    const stretchBonus = recovery.stretchDone ? 8 : 0;
    return Math.max(10, Math.min(100, 100 - sorenessPenalty - sleepPenalty + stretchBonus));
  }, [recovery]);

  // live session simulation
  const [session, setSession] = useState({
    elapsed: 754,
    pace: 415,
    speed: 8.6,
    cadence: 172,
    hr: 158,
    laps: [],
    sprintIdx: 6,
  });
  useEffect(() => {
    if (authState !== "app") return;
    const id = setInterval(() => {
      setSession((s) => {
        const t = s.elapsed + 1;
        return {
          ...s,
          elapsed: t,
          pace: 415 + Math.sin(t / 9) * 28,
          speed: 8.6 + Math.sin(t / 7) * 1.4,
          cadence: 172 + Math.sin(t / 11) * 6,
          hr: 158 + Math.sin(t / 13) * 9,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [authState]);
  const onLap = useCallback(() => {
    setSession((s) => ({
      ...s,
      laps: [...s.laps, 380 + Math.random() * 70],
      sprintIdx: Math.min(SPRINT_GOAL, s.sprintIdx + 1),
    }));
  }, []);

  // AI: single call returning all 5 outputs
  const [ai, setAi] = useState(FALLBACK_AI);
  const [aiLoading, setAiLoading] = useState(true);
  const fetchAi = useCallback(async () => {
    setAiLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are the AI coach inside "Stride", a sprint-training app. Given this athlete context, respond with ONLY strict JSON (no markdown fences, no preamble) matching exactly this shape:
{"postWorkoutInsight": string, "weeklyNarrative": string, "liveCues": string[5], "cycleTip": string, "weeklyPlan": [{"day": "Mon".."Sun", "focus": string, "intensity": 0|1|2|3}] (7 entries)}

Context:
- Today's workout: 8 sprints, 3.2 mi, avg pace 6:52/mi, fastest minute was minute 7 at 6:28/mi.
- Recent runs (newest first, avg pace): 6:52, 7:05, 6:58, 7:16, 7:11, 7:27 — improving trend.
- Menstrual cycle: day ${cycleDay} of ${cycleLength} (${phaseFor(cycleDay)} phase). Make cycleTip phase-aware.
- postWorkoutInsight: 1–2 sentences referencing a specific minute. weeklyNarrative: 1–2 sentences on the trend. liveCues: 5 short motivational mid-sprint voice cues. weeklyPlan focus: short (≤5 words).`,
            },
          ],
        }),
      });
      const data = await response.json();
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
  }, [cycleDay]);
  useEffect(() => {
    if (authState === "app") fetchAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  // splash timer
  useEffect(() => {
    if (authState !== "splash") return;
    const id = setTimeout(() => setAuthState("login"), 1700);
    return () => clearTimeout(id);
  }, [authState]);

  const cues = aiLoading ? FALLBACK_AI.liveCues : ai.liveCues;

  let body;
  if (authState === "splash") body = <Splash />;
  else if (authState === "login") body = <Login onLogin={() => setAuthState("app")} />;
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
            />
          )}
          {activeTab === "live" && <Live session={session} onLap={onLap} cues={cues} />}
          {activeTab === "pace" && <Pace />}
          {activeTab === "history" && <History />}
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
        {body}
      </div>
    </div>
  );
}

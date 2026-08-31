import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { T, card } from "./theme";
import {
  SPRINT_GOAL,
  TODAY_IDX,
  DAY_LETTERS,
  CORE_EXERCISES,
  CORE_GOAL,
  CORE_HISTORY,
  fmtPace,
  fmtClock,
  readinessColor,
  readinessLabel,
  phaseFor,
  PHASE_INFO,
  vo2maxCategory,
  estimateVO2,
  ACHIEVEMENTS,
  TIER_STYLE,
  RPE_LABELS,
  achievementContext,
  computeGamification,
  estimateTSS,
  computeACWR,
  confidenceBreakdown,
} from "./data";
import { Eyebrow, Chevron, RunningLegs, BackHeader, StatCard, ProgressRing, BreathingGuide, CoreExerciseRow, AchievementBadge } from "./components";

/* ───────── Screens ───────── */

export function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <RunningLegs />
      <Text style={{ fontSize: 20, fontWeight: "700", color: T.ink }}>Stride</Text>
    </View>
  );
}

export function Login({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const field = {
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.hair,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    color: T.ink,
    fontSize: 15,
    width: "100%",
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
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28, gap: 14 }}>
      <View style={{ alignItems: "center", gap: 2, marginBottom: 14 }}>
        <View style={{ marginBottom: 12 }}>
          <RunningLegs />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: T.ink }}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </Text>
        <Text style={{ fontSize: 13, color: T.sub }}>Track sprints, strides and recovery</Text>
      </View>
      <TextInput
        style={field}
        placeholder="Email"
        placeholderTextColor={T.sub}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={field}
        placeholder="Password"
        placeholderTextColor={T.sub}
        secureTextEntry
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />
      {!!error && <Text style={{ fontSize: 13, color: T.red }}>{error}</Text>}
      {!!notice && <Text style={{ fontSize: 13, color: T.accent1 }}>{notice}</Text>}
      <Pressable
        onPress={submit}
        disabled={loading}
        style={{ backgroundColor: T.accent1, borderRadius: 999, paddingVertical: 15, alignItems: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
          {loading ? "Please wait…" : mode === "signin" ? "Log In" : "Sign Up"}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
          setNotice("");
        }}
      >
        <Text style={{ fontSize: 13, color: T.sub, textAlign: "center", marginTop: 8 }}>
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <Text style={{ color: T.accent1, fontWeight: "600" }}>{mode === "signin" ? "Sign up" : "Log in"}</Text>
        </Text>
      </Pressable>
    </View>
  );
}

export function Summary({
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
  const dots = ["", T.sub, T.accent2, T.accent1];
  const gamification = computeGamification(achievementCtx);
  const trainingLoad = computeACWR(history);
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 14, color: T.sub }}>
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: "700", color: T.ink }}>{greeting}</Text>
        </View>
        <Pressable onPress={onSignOut} hitSlop={8}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: T.sub }}>Log Out</Text>
        </Pressable>
      </View>

      <View style={card({ padding: 24 })}>
        <ProgressRing value={todayStats.sprints} goal={SPRINT_GOAL} unit="sprints" />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatCard value={`${todayStats.maxSpeed.toFixed(1)} mph`} label="Max Speed" />
        <StatCard value={`${todayStats.distance.toFixed(1)} mi`} label="Distance" />
        <StatCard value={fmtClock(todayStats.duration)} label="Duration" />
      </View>

      <Pressable
        onPress={openRecovery}
        style={card({ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" })}
      >
        <View>
          <Eyebrow>Recovery</Eyebrow>
          <Text style={{ fontSize: 14, fontWeight: "600", color: T.ink, marginTop: 4 }}>
            Readiness {readinessLabel(readiness)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: readinessColor(readiness) }}>{readiness}</Text>
          <Chevron />
        </View>
      </Pressable>

      <Pressable
        onPress={openCycle}
        style={card({ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" })}
      >
        <View>
          <Eyebrow>Cycle · Day {cycleDay}</Eyebrow>
          <Text style={{ fontSize: 14, fontWeight: "600", color: T.ink, marginTop: 4 }}>{phase} phase</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 13, color: T.sub }}>Period in {periodIn}d</Text>
          <Chevron />
        </View>
      </Pressable>

      <Pressable
        onPress={openAchievements}
        style={card({ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" })}
      >
        <View>
          <Eyebrow color={T.amber}>Achievements</Eyebrow>
          <Text style={{ fontSize: 14, fontWeight: "600", color: T.ink, marginTop: 4 }}>
            Level {gamification.level} · {gamification.unlocked.length}/{ACHIEVEMENTS.length} unlocked
          </Text>
        </View>
        <Chevron />
      </Pressable>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable onPress={openTrainingLoad} style={card({ padding: 14, flex: 1 })}>
          <Eyebrow color={T.accent2}>Training Load</Eyebrow>
          <Text style={{ fontSize: 13, fontWeight: "700", color: T.ink, marginTop: 6 }}>{trainingLoad.risk}</Text>
        </Pressable>
        <Pressable onPress={openForm} style={card({ padding: 14, flex: 1 })}>
          <Eyebrow color={T.accent1}>Form</Eyebrow>
          <Text style={{ fontSize: 13, fontWeight: "700", color: T.ink, marginTop: 6 }}>View gait data</Text>
        </Pressable>
        <Pressable onPress={openDevices} style={card({ padding: 14, flex: 1 })}>
          <Eyebrow color={T.sub}>Devices</Eyebrow>
          <Text style={{ fontSize: 13, fontWeight: "700", color: T.ink, marginTop: 6 }}>Fallback tier</Text>
        </Pressable>
      </View>

      <View style={card({ padding: 16 })}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: T.ink }}>This Week's Plan</Text>
          <Pressable onPress={onRegenerate}>
            <Text style={{ color: T.accent1, fontSize: 11, fontWeight: "700" }}>Regenerate</Text>
          </Pressable>
        </View>
        {aiLoading ? (
          <Text style={{ fontSize: 13, color: T.sub, fontStyle: "italic" }}>Building your plan…</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {ai.weeklyPlan.map((d) => (
              <View key={d.day} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ width: 30, fontSize: 11, fontWeight: "700", color: T.sub }}>{d.day.toUpperCase()}</Text>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: d.intensity === 0 ? "transparent" : dots[Math.min(3, d.intensity)],
                    borderWidth: d.intensity === 0 ? 1.5 : 0,
                    borderColor: T.hair,
                  }}
                />
                <Text style={{ fontSize: 13, fontWeight: "600", color: T.ink }}>{d.focus}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={card({ padding: 16 })}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: T.ink, marginBottom: 14 }}>This Week</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 90 }}>
          {weekBars.map((v, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
              <View
                style={{
                  width: "100%",
                  borderRadius: 6,
                  height: `${Math.max(4, (v / maxBar) * 100)}%`,
                  backgroundColor: i === TODAY_IDX ? T.accent1 : T.hair,
                }}
              />
              <Text style={{ fontSize: 10, color: i === TODAY_IDX ? T.ink : T.sub, fontWeight: i === TODAY_IDX ? "700" : "400" }}>
                {DAY_LETTERS[i]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function Pace({ paceMinutes, sprintMinutes, vo2History, vo2Labels }) {
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
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 13, color: T.sub }}>Average Pace</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: T.ink }}>{hasPace ? fmtPace(avg) : "—:—"}</Text>
          <Text style={{ fontSize: 15, color: T.sub, fontWeight: "400", marginLeft: 4, marginBottom: 3 }}>/mi</Text>
        </View>
      </View>

      <View style={card({ padding: 16 })}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Eyebrow color={T.accent2}>VO2max Estimate</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 4 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: T.ink }}>{hasVO2 ? currentVO2.toFixed(1) : "—"}</Text>
              <Text style={{ fontSize: 13, color: T.sub, fontWeight: "400", marginLeft: 4, marginBottom: 2 }}>ml/kg/min</Text>
            </View>
          </View>
          {vo2Cat && (
            <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: `${vo2Cat.color}33` }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: vo2Cat.color }}>{vo2Cat.label}</Text>
            </View>
          )}
        </View>
        {hasVO2 ? (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 60, marginTop: 16 }}>
            {vo2History.map((v, i) => {
              const h = 25 + ((v - vo2Min) / (vo2Max - vo2Min || 1)) * 75;
              return (
                <View key={i} style={{ flex: 1, alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                  <View
                    style={{
                      width: "100%",
                      height: `${h}%`,
                      borderRadius: 4,
                      backgroundColor: i === vo2History.length - 1 ? T.accent2 : T.hair,
                    }}
                  />
                  <Text style={{ fontSize: 8, color: T.sub }}>{vo2Labels[i]}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ fontSize: 12, color: T.sub, marginTop: 12 }}>Not enough runs yet to estimate VO2max.</Text>
        )}
      </View>

      {hasPace ? (
        <>
          <View style={card({ padding: 16 })}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 120 }}>
              {paceMinutes.map((p, i) => {
                const h = 20 + ((max - p) / (max - min || 1)) * 80;
                return (
                  <View key={i} style={{ flex: 1, alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                    <View
                      style={{
                        width: "100%",
                        height: `${h}%`,
                        borderRadius: 5,
                        backgroundColor: sprintMinutes.has(i) ? T.accent2 : T.accent1,
                      }}
                    />
                    <Text style={{ fontSize: 9, color: T.sub }}>{i + 1}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={card({ paddingHorizontal: 16 })}>
            {paceMinutes.map((p, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  borderBottomWidth: i < paceMinutes.length - 1 ? 1 : 0,
                  borderBottomColor: T.hair,
                }}
              >
                <Text style={{ color: T.sub, fontWeight: "600", fontSize: 13 }}>Min {i + 1}</Text>
                <Text style={{ color: sprintMinutes.has(i) ? T.accent2 : T.ink, fontWeight: "700", fontSize: 13 }}>
                  {fmtPace(p)} /mi
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={card({ padding: 16 })}>
          <Text style={{ fontSize: 13, color: T.sub, textAlign: "center" }}>
            No pace data yet — complete a run to see your minute-by-minute splits here.
          </Text>
        </View>
      )}
    </View>
  );
}

export function History({ history, monthlyHistory }) {
  const [range, setRange] = useState("Weekly");
  const deltas = history.slice(0, -1).map((w, i) => ({
    date: w.date,
    delta: w.pace - history[i + 1].pace,
  }));
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d.delta)), 1);
  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: T.ink }}>History</Text>
        <Text style={{ fontSize: 13, color: T.sub }}>Recent workouts</Text>
      </View>

      <View style={card({ padding: 16 })}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>Pace Change, Day to Day</Text>
        <Text style={{ fontSize: 11, color: T.sub, marginBottom: 16 }}>vs. the previous run · faster ↑ slower ↓</Text>
        {deltas.length === 0 ? (
          <Text style={{ fontSize: 13, color: T.sub, textAlign: "center", paddingVertical: 30 }}>
            Complete at least two runs to see how your pace is trending.
          </Text>
        ) : (
        <View style={{ flexDirection: "row", gap: 10, height: 130 }}>
          {[...deltas].reverse().map((d, i) => {
            const faster = d.delta < 0;
            const h = (Math.abs(d.delta) / maxAbs) * 42;
            return (
              <View key={i} style={{ flex: 1, alignItems: "center" }}>
                <View style={{ flex: 1, justifyContent: "center", width: "100%" }}>
                  <View style={{ width: "100%" }}>
                    {faster && (
                      <View style={{ position: "absolute", bottom: 1, width: "100%", alignItems: "center" }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: T.accent1, marginBottom: 3 }}>{d.delta}s</Text>
                        <View style={{ width: "70%", height: h, backgroundColor: T.accent1, borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
                      </View>
                    )}
                    <View style={{ width: "100%", height: 2, backgroundColor: T.hair }} />
                    {!faster && (
                      <View style={{ position: "absolute", top: 1, width: "100%", alignItems: "center" }}>
                        <View style={{ width: "70%", height: h, backgroundColor: T.red, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 }} />
                        <Text style={{ fontSize: 10, fontWeight: "700", color: T.red, marginTop: 3 }}>+{d.delta}s</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={{ fontSize: 10, color: T.sub, marginTop: 6 }}>{d.date}</Text>
              </View>
            );
          })}
        </View>
        )}
      </View>

      <View style={{ flexDirection: "row", backgroundColor: T.bg, borderWidth: 1, borderColor: T.hair, borderRadius: 999, padding: 3 }}>
        {["Weekly", "Monthly"].map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: range === r ? T.cardBg : "transparent",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: range === r ? T.ink : T.sub }}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <View style={card({ paddingHorizontal: 16 })}>
        {(range === "Weekly" ? history.length : monthlyHistory.length) === 0 ? (
          <Text style={{ fontSize: 13, color: T.sub, textAlign: "center", paddingVertical: 20 }}>
            No workouts logged yet. Finish a run to see it here.
          </Text>
        ) : range === "Weekly"
          ? history.map((w, i) => {
              const prev = history[i + 1];
              const faster = prev ? w.pace < prev.pace : true;
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 13,
                    borderBottomWidth: i < history.length - 1 ? 1 : 0,
                    borderBottomColor: T.hair,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: T.ink }}>{w.date}</Text>
                    <Text style={{ fontSize: 12, color: T.sub }}>
                      {w.sprints} sprints · {w.distance}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>{fmtPace(w.pace)} /mi</Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: faster ? T.accent1 : T.sub }}>
                      {faster ? "↑ faster" : "↓ slower"}
                    </Text>
                  </View>
                </View>
              );
            })
          : monthlyHistory.map((w, i) => {
              const prev = monthlyHistory[i + 1];
              const faster = prev ? w.avgPace < prev.avgPace : true;
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 13,
                    borderBottomWidth: i < monthlyHistory.length - 1 ? 1 : 0,
                    borderBottomColor: T.hair,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: T.ink }}>{w.period}</Text>
                    <Text style={{ fontSize: 12, color: T.sub }}>
                      {w.runs} runs · {w.distance}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>{fmtPace(w.avgPace)} /mi avg</Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: faster ? T.accent1 : T.sub }}>
                      {faster ? "↑ faster" : "↓ slower"}
                    </Text>
                  </View>
                </View>
              );
            })}
      </View>
    </View>
  );
}

export function Coach({ ai, aiLoading }) {
  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: T.ink }}>AI Coach</Text>
        <Text style={{ fontSize: 13, color: T.sub }}>Insights from your training</Text>
      </View>
      {aiLoading ? (
        <View style={card({ padding: 20 })}>
          <Text style={{ fontSize: 13, color: T.sub, fontStyle: "italic" }}>Analyzing your workout…</Text>
        </View>
      ) : (
        <>
          <View style={card({ padding: 18 })}>
            <Eyebrow>Post-Workout</Eyebrow>
            <Text style={{ fontSize: 14, color: T.ink, lineHeight: 22, marginTop: 8 }}>{ai.postWorkoutInsight}</Text>
          </View>
          <View style={card({ padding: 18 })}>
            <Eyebrow color={T.accent2}>This Week</Eyebrow>
            <Text style={{ fontSize: 14, color: T.ink, lineHeight: 22, marginTop: 8 }}>{ai.weeklyNarrative}</Text>
          </View>
          <View style={card({ padding: 18 })}>
            <Eyebrow color={T.amber}>Core Strength</Eyebrow>
            <Text style={{ fontSize: 14, color: T.ink, lineHeight: 22, marginTop: 8 }}>{ai.coreInsight}</Text>
          </View>
          <View style={card({ padding: 18 })}>
            <Eyebrow color={T.accent1}>Aerobic Fitness</Eyebrow>
            <Text style={{ fontSize: 14, color: T.ink, lineHeight: 22, marginTop: 8 }}>{ai.vo2maxNote}</Text>
          </View>
        </>
      )}
    </View>
  );
}

export function CycleScreen({ cycleDay, cycleLength, periodLength, onBack, onLogPeriod, onAdvanceDay, ai, aiLoading }) {
  const [expandedPhase, setExpandedPhase] = useState(null);
  const phase = phaseFor(cycleDay);
  const periodIn = cycleLength - cycleDay + 1;

  // July 2026 calendar: July 1 is a Wednesday, 31 days
  const firstDow = 3;
  const daysInMonth = 31;
  const today = 14;
  const cycleDayOf = (d) => {
    let cd = (((cycleDay + (d - today)) % cycleLength) + cycleLength) % cycleLength;
    return cd === 0 ? cycleLength : cd;
  };

  return (
    <View style={{ gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Cycle Tracking" onBack={onBack} />
      <View>
        <Text style={{ fontSize: 14, fontWeight: "600", color: T.ink }}>
          Day {cycleDay} of {cycleLength} · {phase} phase
        </Text>
        <Text style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>Tap a phase for details</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 6 }}>
        {Object.keys(PHASE_INFO).map((p) => {
          const active = expandedPhase === p;
          return (
            <Pressable
              key={p}
              onPress={() => setExpandedPhase(active ? null : p)}
              style={{
                flex: 1,
                paddingVertical: 9,
                paddingHorizontal: 2,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? T.accent1 : T.hair,
                backgroundColor: active ? T.pillActiveBg : T.cardBg,
                alignItems: "center",
              }}
            >
              <Text style={{ color: active ? T.accent1 : p === phase ? T.ink : T.sub, fontSize: 10.5, fontWeight: "600" }}>{p}</Text>
            </Pressable>
          );
        })}
      </View>

      {expandedPhase && (
        <View style={card({ padding: 16 })}>
          <Eyebrow>
            {expandedPhase} · {PHASE_INFO[expandedPhase].range}
          </Eyebrow>
          <Text style={{ fontSize: 13, color: T.ink, lineHeight: 19, marginTop: 8 }}>{PHASE_INFO[expandedPhase].desc}</Text>
          <Text style={{ fontSize: 13, color: T.sub, lineHeight: 19, marginTop: 8 }}>{PHASE_INFO[expandedPhase].tip}</Text>
        </View>
      )}

      <View style={card({ padding: 16 })}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: T.ink, marginBottom: 12 }}>July 2026</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {DAY_LETTERS.map((d, i) => (
            <View key={i} style={{ width: `${100 / 7}%`, paddingBottom: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: T.sub, textAlign: "center" }}>{d}</Text>
            </View>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => (
            <View key={`b${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const cd = cycleDayOf(d);
            const isPeriod = cd <= periodLength;
            const isFertile = cd >= 12 && cd <= 16;
            const isToday = d === today;
            return (
              <View key={d} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    borderRadius: 10,
                    backgroundColor: isToday ? T.pillActiveBg : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: isToday ? "700" : "400", color: isToday ? T.accent1 : T.ink }}>{d}</Text>
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: isPeriod ? T.red : isFertile ? T.accent1 : "transparent",
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={card({ padding: 16 })}>
        <Eyebrow color={T.red}>Next Period</Eyebrow>
        <Text style={{ fontSize: 24, fontWeight: "800", color: T.ink, marginTop: 6 }}>In {periodIn} days</Text>
      </View>

      <View style={card({ padding: 16 })}>
        <Eyebrow>Training Tip</Eyebrow>
        {aiLoading ? (
          <Text style={{ color: T.sub, fontStyle: "italic", fontSize: 13, marginTop: 8 }}>Thinking…</Text>
        ) : (
          <Text style={{ fontSize: 13, color: T.ink, lineHeight: 19, marginTop: 8 }}>{ai.cycleTip}</Text>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={onLogPeriod}
          style={{ flex: 1, backgroundColor: "transparent", borderWidth: 1.5, borderColor: T.hair, borderRadius: 999, paddingVertical: 13, alignItems: "center" }}
        >
          <Text style={{ color: T.ink, fontWeight: "700", fontSize: 14 }}>Log Period Start</Text>
        </Pressable>
        <Pressable
          onPress={onAdvanceDay}
          style={{ flex: 1, backgroundColor: T.accent1, borderRadius: 999, paddingVertical: 13, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>+1 Day</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RecoveryScreen({ recovery, setRecovery, readiness, onBack }) {
  const { sleepHours, restingHR, soreness, stretchDone } = recovery;
  return (
    <View style={{ gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Recovery" onBack={onBack} />

      <View style={{ alignItems: "center", paddingVertical: 10 }}>
        <Text style={{ fontSize: 52, fontWeight: "800", color: readinessColor(readiness), lineHeight: 56 }}>{readiness}</Text>
        <Text style={{ fontSize: 13, color: T.sub, marginTop: 6 }}>{readinessLabel(readiness)} readiness today</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatCard value={`${sleepHours} hr`} label="Sleep" />
        <StatCard value={`${restingHR} bpm`} label="Resting HR" />
      </View>

      <View style={card({ padding: 16 })}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: T.ink, marginBottom: 12 }}>Muscle Soreness</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["Low", "Moderate", "High"].map((s) => {
            const active = soreness === s;
            return (
              <Pressable
                key={s}
                onPress={() => setRecovery((r) => ({ ...r, soreness: s }))}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? T.accent1 : T.hair,
                  backgroundColor: active ? T.pillActiveBg : "transparent",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: active ? T.accent1 : T.sub, fontSize: 13, fontWeight: "600" }}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={() => setRecovery((r) => ({ ...r, stretchDone: !r.stretchDone }))}
        style={card({ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" })}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>Stretching</Text>
          <Text style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{stretchDone ? "Done" : "Not yet"}</Text>
        </View>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: stretchDone ? T.accent1 : "transparent",
            borderWidth: stretchDone ? 0 : 2,
            borderColor: T.hair,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {stretchDone && (
            <View
              style={{
                width: 9,
                height: 5,
                borderLeftWidth: 2.5,
                borderLeftColor: "#fff",
                borderBottomWidth: 2.5,
                borderBottomColor: "#fff",
                transform: [{ rotate: "-45deg" }, { translateX: 1 }, { translateY: -1 }],
              }}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
}

export function Core({ coreToday, coreCompleted, holdingId, holdElapsed, hr, onLogReps, onStartHold, onStopHold }) {
  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: T.ink }}>Core</Text>
        <Text style={{ fontSize: 13, color: T.sub }}>Today's core session</Text>
      </View>

      <View style={card({ padding: 24 })}>
        <ProgressRing value={coreCompleted} goal={CORE_GOAL} unit="exercises" />
      </View>

      <BreathingGuide hr={hr} compact />

      <View style={{ gap: 10 }}>
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
      </View>

      <View style={card({ padding: 16 })}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: T.ink, marginBottom: 12 }}>Recent Sessions</Text>
        {CORE_HISTORY.length === 0 && (
          <Text style={{ fontSize: 13, color: T.sub }}>No core sessions yet — finish today's to start your history.</Text>
        )}
        {CORE_HISTORY.map((h, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 10,
              borderBottomWidth: i < CORE_HISTORY.length - 1 ? 1 : 0,
              borderBottomColor: T.hair,
            }}
          >
            <Text style={{ color: T.ink, fontWeight: "600", fontSize: 13 }}>{h.date}</Text>
            <Text style={{ color: T.sub, fontSize: 13 }}>
              {h.completed}/{CORE_GOAL} · {h.totalReps} reps · {h.holdSec}s hold
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function AchievementsScreen({ ctx, onBack }) {
  const { unlocked, unlockedIds, totalXP, level, xpIntoLevel } = computeGamification(ctx);
  const categories = [...new Set(ACHIEVEMENTS.map((a) => a.category))];
  const featured = unlocked.filter((a) => a.tier === "gold" || a.tier === "legendary");
  return (
    <View style={{ gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Achievements" onBack={onBack} />

      <View style={card({ padding: 20 })}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Eyebrow>Level {level}</Eyebrow>
            <Text style={{ fontSize: 26, fontWeight: "800", color: T.ink, marginTop: 4 }}>{totalXP} XP</Text>
          </View>
          <Text style={{ fontSize: 13, color: T.sub, textAlign: "right" }}>
            {unlocked.length}/{ACHIEVEMENTS.length}{"\n"}unlocked
          </Text>
        </View>
        <View style={{ height: 6, backgroundColor: T.hair, borderRadius: 3, marginTop: 14, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${xpIntoLevel}%`, backgroundColor: T.accent1, borderRadius: 3 }} />
        </View>
        <Text style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
          {xpIntoLevel}/100 XP to Level {level + 1}
        </Text>
      </View>

      {featured.length > 0 && (
        <View>
          <Eyebrow color={T.amber}>Trophy Case</Eyebrow>
          <View style={{ gap: 10, marginTop: 10 }}>
            {featured.map((a) => (
              <AchievementBadge key={a.id} achievement={a} unlocked ctx={ctx} onPress={() => {}} />
            ))}
          </View>
        </View>
      )}

      {categories.map((cat) => (
        <View key={cat}>
          <Eyebrow>{cat}</Eyebrow>
          <View style={{ gap: 10, marginTop: 10 }}>
            {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => (
              <AchievementBadge key={a.id} achievement={a} unlocked={unlockedIds.has(a.id)} ctx={ctx} onPress={() => {}} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function TrainingLoadScreen({ readiness, rpeLog, history, confidenceScore, onBack }) {
  const acwr = computeACWR(history);
  const { risk, riskColor } = acwr;
  const confidence = confidenceBreakdown(history);
  const lastRun = history[0];
  const avgPace = history.length ? history.reduce((s, w) => s + w.pace, 0) / history.length : 0;
  const vsBaseline = lastRun ? lastRun.pace - avgPace : 0;
  return (
    <View style={{ gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Training Load" onBack={onBack} />

      <View style={card({ padding: 18 })}>
        <Eyebrow>Acute:Chronic Workload Ratio</Eyebrow>
        {acwr.hasData ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <Text style={{ fontSize: 30, fontWeight: "800", color: T.ink }}>{acwr.ratio}</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: riskColor }}>{risk}</Text>
            </View>
            <Text style={{ fontSize: 12, color: T.sub, marginTop: 6 }}>
              Acute (recent 3 runs): ~{acwr.acute} · Chronic (all logged runs): ~{acwr.chronic} relative-effort units
            </Text>
            <Text style={{ fontSize: 11, color: T.sub, marginTop: 8, fontStyle: "italic" }}>
              Estimated from pace/distance — not a substitute for how your body actually feels.
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 13, color: T.sub, marginTop: 8 }}>
            Log a few runs to see your acute:chronic workload ratio here.
          </Text>
        )}
      </View>

      {lastRun ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard value={`${estimateTSS(lastRun)}`} label="Last Run Effort (est.)" />
          <StatCard
            value={`${vsBaseline <= 0 ? "−" : "+"}${Math.abs(Math.round(vsBaseline))}s`}
            label="vs. Your Baseline"
            valueColor={vsBaseline <= 0 ? T.accent1 : T.red}
          />
        </View>
      ) : (
        <View style={card({ padding: 16 })}>
          <Text style={{ fontSize: 13, color: T.sub }}>No runs logged yet — complete a workout to see your effort here.</Text>
        </View>
      )}

      <View style={card({ padding: 18 })}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow color={T.accent2}>Data Confidence</Eyebrow>
          <Text style={{ fontSize: 20, fontWeight: "800", color: T.accent2 }}>{history.length ? confidenceScore : "—"}</Text>
        </View>
        <View style={{ gap: 8, marginTop: 12 }}>
          {confidence.map((row) => (
            <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: T.sub }}>{row.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: row.good ? T.accent1 : T.ink }}>{row.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={card({ padding: 18 })}>
        <Eyebrow>Perceived Effort Log</Eyebrow>
        {rpeLog.length === 0 ? (
          <Text style={{ fontSize: 12, color: T.sub, marginTop: 8 }}>
            Rate your effort (1–10) when you end a workout to build this log.
          </Text>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {rpeLog.map((r, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: T.ink, fontSize: 13 }}>
                  RPE {r.rpe} · {RPE_LABELS[r.rpe] || ""}
                </Text>
                <Text style={{ color: T.sub, fontSize: 13 }}>{r.hr} bpm avg</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export function FormScreen({ session, onBack }) {
  const { cadence, hr } = session;
  const groundContactMs = Math.round(240 - (cadence - 172) * 1.4);
  const verticalOscCm = Math.round((9.2 - (cadence - 172) * 0.03) * 10) / 10;
  const strikePattern = cadence > 175 ? "Midfoot" : cadence > 168 ? "Heel" : "Forefoot";
  const symmetryPct = 96 + Math.round(Math.sin(hr / 7) * 3);
  const formScore = Math.max(0, Math.min(100, Math.round(72 + (cadence - 172) * 1.8 - Math.abs(100 - symmetryPct) * 2)));
  const fatigueCurve = [100, 98, 95, 93, 88, 84];
  return (
    <View style={{ gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Form" onBack={onBack} />

      <View style={card({ padding: 20, alignItems: "center" })}>
        <Eyebrow>Form Score</Eyebrow>
        <Text style={{ fontSize: 44, fontWeight: "800", color: T.ink, marginTop: 6 }}>{formScore}</Text>
        <Text style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>Fallback tier (phone-only) · estimated, not diagnostic</Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ width: "48%" }}>
          <StatCard value={strikePattern} label="Strike Pattern" />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={`${symmetryPct}%`} label="L/R Symmetry" />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={`${groundContactMs} ms`} label="Ground Contact" />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={`${verticalOscCm} cm`} label="Vertical Oscillation" />
        </View>
      </View>

      <View style={card({ padding: 16 })}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: T.ink, marginBottom: 4 }}>Cadence Fatigue Curve</Text>
        <Text style={{ fontSize: 11, color: T.sub, marginBottom: 14 }}>% of starting cadence, by kilometer this run</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 90 }}>
          {fatigueCurve.map((v, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
              <View style={{ width: "100%", height: `${v}%`, borderRadius: 4, backgroundColor: v < 90 ? T.amber : T.accent1 }} />
              <Text style={{ fontSize: 9, color: T.sub }}>{i + 1}k</Text>
            </View>
          ))}
        </View>
        {fatigueCurve[fatigueCurve.length - 1] < 90 && (
          <Text style={{ fontSize: 12, color: T.amber, marginTop: 12 }}>
            Cadence dropped {100 - fatigueCurve[fatigueCurve.length - 1]}% by the final kilometer — a common late-run fatigue
            signature.
          </Text>
        )}
      </View>

      <View style={card({ padding: 16 })}>
        <Eyebrow color={T.red}>About These Numbers</Eyebrow>
        <Text style={{ fontSize: 12, color: T.sub, lineHeight: 18, marginTop: 8 }}>
          Strike pattern and symmetry are unreliable from a pocketed phone — arm swing and phone placement dominate the
          signal. For validated running-dynamics data, connect a Garmin Running Dynamics Pod, Stryd, or an Apple Watch
          SE/Series 6+ in Devices.
        </Text>
      </View>
    </View>
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

export function DevicesScreen({ onBack, watchPaired, watchConnected }) {
  const tiers = DEVICE_TIERS.map((d) => {
    if (d.sources !== "Apple Watch SE / Series 6+") return d;
    if (watchConnected) {
      return { ...d, action: "Connected — streaming live", status: "active" };
    }
    if (watchPaired) {
      return { ...d, action: "Paired — open Stride on your watch to start a run", status: "needs-key" };
    }
    return d;
  });

  return (
    <View style={{ gap: 16, paddingBottom: 30 }}>
      <BackHeader title="Devices" onBack={onBack} />
      <Text style={{ fontSize: 13, color: T.sub }}>
        Every metric in this app is only as good as its source. Here's exactly what's powering yours.
      </Text>

      {tiers.map((d) => (
        <View key={d.tier} style={card({ padding: 18, borderLeftWidth: 3, borderLeftColor: d.color })}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Eyebrow color={d.color}>{d.tier} Tier</Eyebrow>
            {d.status === "active" && (
              <View style={{ borderWidth: 1, borderColor: T.accent1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: T.accent1 }}>ACTIVE</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: T.ink, marginTop: 8 }}>{d.sources}</Text>
          <Text style={{ fontSize: 12, color: T.sub, marginTop: 6, lineHeight: 17 }}>{d.metrics}</Text>
          <View
            style={{
              marginTop: 14,
              backgroundColor: d.status === "active" ? T.hair : "transparent",
              borderWidth: d.status === "active" ? 0 : 1.5,
              borderColor: T.hair,
              borderRadius: 999,
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ color: d.status === "active" ? T.sub : d.color, fontWeight: "700", fontSize: 12 }}>{d.action}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

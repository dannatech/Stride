import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { T, card } from "./theme";
import {
  SPRINTS_TODAY,
  SPRINT_GOAL,
  WEEK_BARS,
  TODAY_IDX,
  DAY_LETTERS,
  HISTORY,
  PACE_MINUTES,
  SPRINT_MINUTES,
  CORE_EXERCISES,
  CORE_GOAL,
  CORE_HISTORY,
  VO2MAX_HISTORY,
  VO2MAX_LABELS,
  fmtPace,
  fmtClock,
  readinessColor,
  readinessLabel,
  phaseFor,
  PHASE_INFO,
  vo2maxCategory,
  estimateVO2,
} from "./data";
import { Eyebrow, Chevron, Logomark, BackHeader, StatCard, ProgressRing, BreathingGuide, CoreExerciseRow } from "./components";

/* ───────── Screens ───────── */

export function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Logomark />
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
          <Logomark size={56} radius={18} fontSize={24} />
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

export function Summary({ ai, aiLoading, onRegenerate, readiness, cycleDay, cycleLength, openCycle, openRecovery, onSignOut }) {
  const phase = phaseFor(cycleDay);
  const periodIn = cycleLength - cycleDay + 1;
  const maxBar = Math.max(...WEEK_BARS, 1);
  const dots = ["", T.sub, T.accent2, T.accent1];
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 14, color: T.sub }}>Tuesday, July 14</Text>
          <Text style={{ fontSize: 22, fontWeight: "700", color: T.ink }}>Good morning</Text>
        </View>
        <Pressable onPress={onSignOut} hitSlop={8}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: T.sub }}>Log Out</Text>
        </Pressable>
      </View>

      <View style={card({ padding: 24 })}>
        <ProgressRing value={SPRINTS_TODAY} goal={SPRINT_GOAL} unit="sprints" />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatCard value="17.4 mph" label="Max Speed" />
        <StatCard value="3.2 mi" label="Distance" />
        <StatCard value="32:08" label="Duration" />
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
          {WEEK_BARS.map((v, i) => (
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

export function Live({ session, onLap, cues }) {
  const { elapsed, pace, speed, cadence, hr, laps, sprintIdx } = session;
  const cue = cues[Math.floor(elapsed / 8) % cues.length];
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: T.accent1 }} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: T.sub }}>Apple Watch Connected</Text>
      </View>

      <View style={card({ paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" })}>
        <Text style={{ fontSize: 13, fontStyle: "italic", color: T.ink, textAlign: "center" }}>"{cue}"</Text>
      </View>

      <BreathingGuide hr={hr} compact />

      <View style={{ alignItems: "center" }}>
        <Eyebrow color={T.sub}>Elapsed</Eyebrow>
        <Text style={{ fontSize: 52, fontWeight: "800", color: T.ink, fontVariant: ["tabular-nums"], lineHeight: 58 }}>
          {fmtClock(elapsed)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}>
          <Text style={{ fontSize: 38, fontWeight: "800", color: T.accent1 }}>{fmtPace(pace)}</Text>
          <Text style={{ fontSize: 15, color: T.sub, marginLeft: 4, marginBottom: 4 }}>/mi</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ width: "48%" }}>
          <StatCard value={`${(elapsed * 0.0028 + 0.4).toFixed(2)} mi`} label="Distance" />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={`${speed.toFixed(1)} mph`} label="Speed" />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={`${Math.round(cadence)} spm`} label="Cadence" />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={`${Math.round(hr)} bpm`} label="Heart Rate" valueColor={T.red} />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={estimateVO2(speed).toFixed(1)} label="Est. VO2 (ml/kg/min)" valueColor={T.accent2} />
        </View>
      </View>

      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: T.ink, marginBottom: 10 }}>
          Sprint {sprintIdx} of {SPRINT_GOAL}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
          {Array.from({ length: SPRINT_GOAL }).map((_, i) => (
            <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i < sprintIdx ? T.accent1 : T.hair }} />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable onPress={onLap} style={{ flex: 1, backgroundColor: T.accent1, borderRadius: 999, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Lap</Text>
        </Pressable>
        <Pressable
          style={{ flex: 1, backgroundColor: "transparent", borderWidth: 1.5, borderColor: T.hair, borderRadius: 999, paddingVertical: 14, alignItems: "center" }}
        >
          <Text style={{ color: T.ink, fontWeight: "700", fontSize: 15 }}>Pause</Text>
        </Pressable>
      </View>

      {laps.length > 0 && (
        <View style={card({ padding: 16 })}>
          {laps.map((l, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 9,
                borderBottomWidth: i < laps.length - 1 ? 1 : 0,
                borderBottomColor: T.hair,
              }}
            >
              <Text style={{ color: T.ink, fontWeight: "600", fontSize: 13 }}>Lap {i + 1}</Text>
              <Text style={{ color: T.sub, fontSize: 13 }}>{fmtPace(l)} /mi</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function Pace() {
  const avg = PACE_MINUTES.reduce((a, b) => a + b, 0) / PACE_MINUTES.length;
  const min = Math.min(...PACE_MINUTES);
  const max = Math.max(...PACE_MINUTES);
  const currentVO2 = VO2MAX_HISTORY[VO2MAX_HISTORY.length - 1];
  const vo2Cat = vo2maxCategory(currentVO2);
  const vo2Min = Math.min(...VO2MAX_HISTORY);
  const vo2Max = Math.max(...VO2MAX_HISTORY);
  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 13, color: T.sub }}>Average Pace</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: T.ink }}>{fmtPace(avg)}</Text>
          <Text style={{ fontSize: 15, color: T.sub, fontWeight: "400", marginLeft: 4, marginBottom: 3 }}>/mi</Text>
        </View>
      </View>

      <View style={card({ padding: 16 })}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Eyebrow color={T.accent2}>VO2max Estimate</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 4 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: T.ink }}>{currentVO2.toFixed(1)}</Text>
              <Text style={{ fontSize: 13, color: T.sub, fontWeight: "400", marginLeft: 4, marginBottom: 2 }}>ml/kg/min</Text>
            </View>
          </View>
          <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: `${vo2Cat.color}33` }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: vo2Cat.color }}>{vo2Cat.label}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 60, marginTop: 16 }}>
          {VO2MAX_HISTORY.map((v, i) => {
            const h = 25 + ((v - vo2Min) / (vo2Max - vo2Min || 1)) * 75;
            return (
              <View key={i} style={{ flex: 1, alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <View
                  style={{
                    width: "100%",
                    height: `${h}%`,
                    borderRadius: 4,
                    backgroundColor: i === VO2MAX_HISTORY.length - 1 ? T.accent2 : T.hair,
                  }}
                />
                <Text style={{ fontSize: 8, color: T.sub }}>{VO2MAX_LABELS[i]}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={card({ padding: 16 })}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 120 }}>
          {PACE_MINUTES.map((p, i) => {
            const h = 20 + ((max - p) / (max - min)) * 80;
            return (
              <View key={i} style={{ flex: 1, alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                <View
                  style={{
                    width: "100%",
                    height: `${h}%`,
                    borderRadius: 5,
                    backgroundColor: SPRINT_MINUTES.has(i) ? T.accent2 : T.accent1,
                  }}
                />
                <Text style={{ fontSize: 9, color: T.sub }}>{i + 1}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={card({ paddingHorizontal: 16 })}>
        {PACE_MINUTES.map((p, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 10,
              borderBottomWidth: i < PACE_MINUTES.length - 1 ? 1 : 0,
              borderBottomColor: T.hair,
            }}
          >
            <Text style={{ color: T.sub, fontWeight: "600", fontSize: 13 }}>Min {i + 1}</Text>
            <Text style={{ color: SPRINT_MINUTES.has(i) ? T.accent2 : T.ink, fontWeight: "700", fontSize: 13 }}>
              {fmtPace(p)} /mi
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function History() {
  const [range, setRange] = useState("Weekly");
  const deltas = HISTORY.slice(0, -1).map((w, i) => ({
    date: w.date,
    delta: w.pace - HISTORY[i + 1].pace,
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
        {HISTORY.map((w, i) => {
          const prev = HISTORY[i + 1];
          const faster = prev ? w.pace < prev.pace : true;
          return (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 13,
                borderBottomWidth: i < HISTORY.length - 1 ? 1 : 0,
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

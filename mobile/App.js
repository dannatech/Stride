import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "./src/theme";
import { SPRINTS_TODAY, SPRINT_GOAL, CORE_EXERCISES, FALLBACK_AI, phaseFor } from "./src/data";
import { TabBar } from "./src/components";
import { supabase } from "./src/supabaseClient";
import { sendWatchUpdate, addWatchActionListener } from "./modules/stride-watch-connectivity";
import {
  Splash,
  Login,
  Summary,
  Live,
  Pace,
  History,
  Coach,
  CycleScreen,
  RecoveryScreen,
  Core,
} from "./src/screens";

function AppShell() {
  const insets = useSafeAreaInsets();

  const [authState, setAuthState] = useState("splash"); // splash | login | app
  const [activeTab, setActiveTab] = useState("summary");
  const [cyclePresented, setCyclePresented] = useState(false);
  const [recoveryPresented, setRecoveryPresented] = useState(false);

  // Supabase auth: resolve the current session once, then react to sign-in/out.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuthState(data.session ? "app" : "login");
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? "app" : "login");
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

  // core exercise tracking
  const [coreToday, setCoreToday] = useState({ situps: 15, twists: 10 });
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

  // AI: single call returning all outputs
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
              content: `You are the AI coach inside "Stride", a sprint, core-strength, and running app. Given this athlete context, respond with ONLY strict JSON (no markdown fences, no preamble) matching exactly this shape:
{"postWorkoutInsight": string, "weeklyNarrative": string, "liveCues": string[5], "cycleTip": string, "coreInsight": string, "vo2maxNote": string, "weeklyPlan": [{"day": "Mon".."Sun", "focus": string, "intensity": 0|1|2|3}] (7 entries)}

Context:
- Today's workout: 8 sprints, 3.2 mi, avg pace 6:52/mi, fastest minute was minute 7 at 6:28/mi.
- Recent runs (newest first, avg pace): 6:52, 7:05, 6:58, 7:16, 7:11, 7:27 — improving trend.
- Menstrual cycle: day ${cycleDay} of ${cycleLength} (${phaseFor(cycleDay)} phase). Make cycleTip phase-aware.
- Core session today: 4 of 6 exercises complete; plank hold 48s (target 60s), up from 40s last session.
- VO2max estimate trend over 6 weeks (ml/kg/min): 44.8, 45.3, 45.9, 46.4, 46.9, 47.5, 47.9 — steadily improving.
- Breathing technique is HR-zone based (box breathing at rest up through 1:1 breathing near max effort); reference it only if natural.
- postWorkoutInsight: 1–2 sentences referencing a specific minute. weeklyNarrative: 1–2 sentences on the trend. liveCues: 5 short motivational mid-sprint voice cues. coreInsight: 1–2 sentences on today's core session and a concrete target for next time. vo2maxNote: 1–2 sentences on the VO2max trend and what it signals. weeklyPlan focus: short (≤5 words).`,
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

  const cues = aiLoading ? FALLBACK_AI.liveCues : ai.liveCues;

  // Push the current state snapshot to the paired Apple Watch app whenever
  // anything it displays changes. The watch has no server access of its
  // own — it's a thin client mirroring whatever the phone sends it.
  useEffect(() => {
    sendWatchUpdate({
      authenticated: authState === "app",
      readiness,
      cycleDay,
      cycleLength,
      periodLength,
      sprintsToday: SPRINTS_TODAY,
      coreToday,
      session,
      ai: aiLoading ? FALLBACK_AI : ai,
    });
  }, [authState, readiness, cycleDay, cycleLength, periodLength, coreToday, session, ai, aiLoading]);

  // Actions performed on the watch (Lap, log reps, log period, etc.) arrive
  // here and are routed through the same handlers the phone UI uses, so
  // state stays consistent regardless of which device triggered the change.
  useEffect(() => {
    const unsubscribe = addWatchActionListener(({ action, params }) => {
      switch (action) {
        case "lap":
          onLap();
          break;
        case "logReps":
          setCoreToday((c) => ({ ...c, [params.id]: params.value }));
          break;
        case "startHold":
          onStartHold(params.id);
          break;
        case "stopHold":
          setCoreToday((c) => ({ ...c, [params.id]: params.value }));
          setHoldingId(null);
          setCoreHr(96);
          break;
        case "logPeriod":
          setCycleDay(1);
          break;
        case "advanceDay":
          setCycleDay((d) => (d % cycleLength) + 1);
          break;
        case "setSoreness":
          setRecovery((r) => ({ ...r, soreness: params.value }));
          break;
        case "toggleStretch":
          setRecovery((r) => ({ ...r, stretchDone: params.value }));
          break;
        default:
          break;
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleLength]);

  let body;
  if (authState === "splash") body = <Splash />;
  else if (authState === "login") body = <Login onSignIn={onSignIn} onSignUp={onSignUp} />;
  else if (cyclePresented)
    body = (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
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
      </ScrollView>
    );
  else if (recoveryPresented)
    body = (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <RecoveryScreen recovery={recovery} setRecovery={setRecovery} readiness={readiness} onBack={() => setRecoveryPresented(false)} />
      </ScrollView>
    );
  else
    body = (
      <>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 110 }}>
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
              onSignOut={onSignOut}
            />
          )}
          {activeTab === "live" && <Live session={session} onLap={onLap} cues={cues} />}
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
          {activeTab === "pace" && <Pace />}
          {activeTab === "history" && <History />}
          {activeTab === "coach" && <Coach ai={ai} aiLoading={aiLoading} />}
        </ScrollView>
        <TabBar active={activeTab} setActive={setActiveTab} bottomInset={insets.bottom} />
      </>
    );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style="light" />
      {body}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={["top", "left", "right"]}>
        <AppShell />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

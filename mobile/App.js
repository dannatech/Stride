import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { View, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { T } from "./src/theme";
import {
  SPRINT_GOAL,
  CORE_EXERCISES,
  CORE_GOAL,
  FALLBACK_AI,
  CORE_HISTORY,
  phaseFor,
  achievementContext,
  fmtPace,
  estimateVO2,
  deriveHistory,
  deriveMonthlyHistory,
  deriveVO2MaxHistory,
  deriveVO2MaxLabels,
  deriveStreaks,
  deriveConfidence,
  deriveTodayStats,
  deriveWeekBars,
  filterRunsByType,
  WORKOUT_TYPES,
} from "./src/data";
import { TabBar } from "./src/components";
import { supabase } from "./src/supabaseClient";
import { usePaceTracker, simulatedVitals } from "./src/usePaceTracker";
import { useWatchConnectivity } from "./src/useWatchConnectivity";
import { addSessionEventListener, sendSessionCommand } from "./modules/stride-watch-connectivity";
import { LiveScreen } from "./src/LiveScreen";
import {
  Splash,
  Login,
  Summary,
  Pace,
  History,
  Coach,
  CycleScreen,
  RecoveryScreen,
  Core,
  AchievementsScreen,
  TrainingLoadScreen,
  FormScreen,
  DevicesScreen,
  ProfileScreen,
} from "./src/screens";

const PACE_SETTINGS_KEY = "stride.paceSettings.v1";
const DEFAULT_PACE_SETTINGS = {
  workoutType: "run",
  goalPaceSecPerMile: WORKOUT_TYPES.run.goalPaceSecPerMile,
  warmupSeconds: WORKOUT_TYPES.run.warmupSeconds,
};

const DEFAULT_PROFILE = { sex: null, birthMonth: null, birthYear: null };

const EMPTY_GAIT_TOTALS = () => ({
  groundContactTime: { sum: 0, count: 0 },
  verticalOscillation: { sum: 0, count: 0 },
  strideLength: { sum: 0, count: 0 },
  power: { sum: 0, count: 0 },
});

function addGaitSample(totals, key, value) {
  if (!Number.isFinite(value) || value <= 0) return;
  totals[key].sum += value;
  totals[key].count += 1;
}

function averageGaitMetric(metric) {
  return metric.count > 0 ? metric.sum / metric.count : null;
}

function AppShell() {
  const insets = useSafeAreaInsets();

  const [authState, setAuthState] = useState("splash"); // splash | login | app
  const [activeTab, setActiveTab] = useState("summary");
  const [cyclePresented, setCyclePresented] = useState(false);
  const [recoveryPresented, setRecoveryPresented] = useState(false);
  const [achievementsPresented, setAchievementsPresented] = useState(false);
  const [trainingLoadPresented, setTrainingLoadPresented] = useState(false);
  const [formPresented, setFormPresented] = useState(false);
  const [devicesPresented, setDevicesPresented] = useState(false);
  const [profilePresented, setProfilePresented] = useState(false);

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
        onResetRun();
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

  // Unfiltered — Summary, AI Coach context, and Achievements care about all
  // activity regardless of type, not whatever the Pace/History trend filter
  // below happens to be set to.
  const history = useMemo(() => deriveHistory(runs), [runs]);
  const vo2History = useMemo(() => deriveVO2MaxHistory(runs), [runs]);
  const streaks = useMemo(() => deriveStreaks(runs), [runs]);
  const confidenceScore = useMemo(() => deriveConfidence(runs), [runs]);
  const rpeLog = useMemo(
    () =>
      runs
        .filter((run) => run.rpe != null)
        .slice(0, 10)
        .map((run) => ({ rpe: run.rpe, hr: run.avg_hr })),
    [runs]
  );
  const todayStats = useMemo(() => deriveTodayStats(runs), [runs]);
  const weekBars = useMemo(() => deriveWeekBars(runs), [runs]);

  // Pace/History trend charts are scoped to one workout type at a time —
  // mixing, say, a 15:00/mi walk into a running pace/VO2max trend would read
  // as a huge, meaningless outlier.
  const [trendType, setTrendType] = useState("run");
  const trendRuns = useMemo(() => filterRunsByType(runs, trendType), [runs, trendType]);
  const trendHistory = useMemo(() => deriveHistory(trendRuns), [trendRuns]);
  const trendMonthlyHistory = useMemo(() => deriveMonthlyHistory(trendRuns), [trendRuns]);
  const trendVo2History = useMemo(() => deriveVO2MaxHistory(trendRuns), [trendRuns]);
  const trendVo2Labels = useMemo(() => deriveVO2MaxLabels(trendRuns), [trendRuns]);
  const trendLatestRun = trendHistory[0];

  const [cycleDay, setCycleDay] = useState(1);
  const [cycleLength] = useState(28);
  const [periodLength] = useState(5);

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

  // Summary preferences and health inputs are account-backed so the Summary
  // tab is consistent across devices. Row-level security limits this row to
  // the signed-in Supabase user.
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [summaryUserId, setSummaryUserId] = useState(null);
  const [summaryLoaded, setSummaryLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (authState !== "app") {
      setSummaryUserId(null);
      setSummaryLoaded(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId || cancelled) return;

      const { data, error } = await supabase.from("user_summary_state").select("*").eq("user_id", userId).maybeSingle();
      if (cancelled) return;
      if (error) console.error("Failed to load Summary data:", error);
      if (data) {
        setProfile({
          sex: data.sex ?? null,
          birthMonth: data.birth_month ?? null,
          birthYear: data.birth_year ?? null,
        });
        setCycleDay(data.cycle_day ?? 1);
        setRecovery({
          sleepHours: Number(data.sleep_hours ?? 7.4),
          restingHR: data.resting_hr ?? 54,
          soreness: data.soreness ?? "Low",
          stretchDone: Boolean(data.stretch_done),
        });
        setCoreToday(data.core_today && typeof data.core_today === "object" ? data.core_today : {});
      }
      setSummaryUserId(userId);
      setSummaryLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  useEffect(() => {
    if (!summaryLoaded || !summaryUserId) return;
    const timeout = setTimeout(async () => {
      const { error } = await supabase.from("user_summary_state").upsert(
        {
          user_id: summaryUserId,
          sex: profile.sex,
          birth_month: profile.birthMonth,
          birth_year: profile.birthYear,
          cycle_day: cycleDay,
          cycle_length: cycleLength,
          period_length: periodLength,
          sleep_hours: recovery.sleepHours,
          resting_hr: recovery.restingHR,
          soreness: recovery.soreness,
          stretch_done: recovery.stretchDone,
          core_today: coreToday,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) console.error("Failed to save Summary data:", error);
    }, 600);
    return () => clearTimeout(timeout);
  }, [summaryLoaded, summaryUserId, profile, cycleDay, cycleLength, periodLength, recovery, coreToday]);

  const updateProfile = useCallback((patch) => {
    setProfile((p) => ({ ...p, ...patch }));
  }, []);

  // Real GPS-tracked live run (see src/usePaceTracker). Lifted to AppShell — not the
  // Live screen itself — so tracking keeps running if the user switches tabs mid-run.
  const [paceSettings, setPaceSettings] = useState(DEFAULT_PACE_SETTINGS);
  useEffect(() => {
    AsyncStorage.getItem(PACE_SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try {
        setPaceSettings((s) => ({ ...s, ...JSON.parse(raw) }));
      } catch {
        // ignore corrupt settings, keep defaults
      }
    });
  }, []);
  const updatePaceSettings = useCallback((patch) => {
    setPaceSettings((s) => {
      const next = { ...s, ...patch };
      AsyncStorage.setItem(PACE_SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  // Switching type resets pace/warm-up to that type's defaults; the user can
  // still fine-tune both afterward with the existing +/- steppers.
  const onChangeWorkoutType = useCallback(
    (type) => {
      const preset = WORKOUT_TYPES[type];
      updatePaceSettings({ workoutType: type, goalPaceSecPerMile: preset.goalPaceSecPerMile, warmupSeconds: preset.warmupSeconds });
    },
    [updatePaceSettings]
  );

  const tracker = usePaceTracker(paceSettings.goalPaceSecPerMile, paceSettings.warmupSeconds);
  const speedMph = tracker.currentPace > 0 ? 3600 / tracker.currentPace : tracker.targetPace > 0 ? 3600 / tracker.targetPace : 0;

  // Apple Watch companion (see watch/StrideWatchApp): the phone stays the
  // source of truth for GPS distance/pace/session state, but a connected
  // watch has real HealthKit heart rate + running-dynamics sensors the phone
  // doesn't, so we prefer its numbers whenever it's actively streaming.
  const watch = useWatchConnectivity();
  const { cadence, hr: simulatedHr } = simulatedVitals(tracker.elapsedSeconds);
  const hr = watch.connected && watch.lastPacket ? watch.lastPacket.heartRate : simulatedHr;
  const watchMetrics =
    watch.connected && watch.lastPacket
      ? {
          groundContactTime: watch.lastPacket.groundContactTime,
          verticalOscillation: watch.lastPacket.verticalOscillation,
          strideLength: watch.lastPacket.strideLength,
          power: watch.lastPacket.power,
        }
      : null;

  // Accumulate valid Watch samples so completed runs persist session-level
  // gait and power averages, rather than only displaying the latest packet.
  const gaitTotalsRef = useRef(EMPTY_GAIT_TOTALS());
  useEffect(() => {
    const packet = watch.lastPacket;
    if (!packet || watch.packetCount === 0) return;
    const totals = gaitTotalsRef.current;
    addGaitSample(totals, "groundContactTime", packet.groundContactTime);
    addGaitSample(totals, "verticalOscillation", packet.verticalOscillation);
    addGaitSample(totals, "strideLength", packet.strideLength);
    addGaitSample(totals, "power", packet.power);
  }, [watch.packetCount, watch.lastPacket]);

  const [sprintIdx, setSprintIdx] = useState(0);
  const [laps, setLaps] = useState([]);
  // Minute-by-minute pace samples + sprint-effort minute flags, captured live so a
  // completed run can persist real Pace-screen splits instead of nothing.
  const minuteLogRef = useRef([]);
  const sprintMinutesRef = useRef(new Set());
  useEffect(() => {
    const t = tracker.elapsedSeconds;
    if (t > 0 && t % 60 === 0 && minuteLogRef.current.length < t / 60) {
      minuteLogRef.current.push(Math.round(tracker.currentPace || tracker.targetPace));
    }
  }, [tracker.elapsedSeconds]);
  const onLap = useCallback(() => {
    setLaps((l) => [...l, tracker.currentPace || tracker.targetPace]);
    setSprintIdx((i) => Math.min(SPRINT_GOAL, i + 1));
    sprintMinutesRef.current.add(Math.floor(tracker.elapsedSeconds / 60));
  }, [tracker.currentPace, tracker.targetPace, tracker.elapsedSeconds]);
  const onResetRun = useCallback(() => {
    minuteLogRef.current = [];
    sprintMinutesRef.current = new Set();
    setSprintIdx(0);
    setLaps([]);
    gaitTotalsRef.current = EMPTY_GAIT_TOTALS();
    tracker.reset();
  }, [tracker]);

  const onEndWorkout = useCallback(
    async (rpe, { notifyWatch = true } = {}) => {
      if (notifyWatch) sendSessionCommand("stop");

      const finalHr = Math.round(hr);
      const distanceMi = Math.round(tracker.distanceMiles * 100) / 100;
      if (tracker.elapsedSeconds > 0 && distanceMi > 0) {
        const { data, error } = await supabase
          .from("runs")
          .insert({
            workout_type: paceSettings.workoutType,
            distance_mi: distanceMi,
            duration_sec: tracker.elapsedSeconds,
            avg_pace_sec: Math.round(tracker.elapsedSeconds / distanceMi),
            sprints: sprintIdx,
            avg_hr: finalHr,
            avg_cadence: Math.round(cadence),
            avg_ground_contact_time_ms: averageGaitMetric(gaitTotalsRef.current.groundContactTime),
            avg_vertical_oscillation_cm: averageGaitMetric(gaitTotalsRef.current.verticalOscillation),
            avg_stride_length_m: averageGaitMetric(gaitTotalsRef.current.strideLength),
            avg_running_power_watts: averageGaitMetric(gaitTotalsRef.current.power),
            rpe: rpe ?? null,
            vo2max: Math.round(estimateVO2(speedMph) * 10) / 10,
            pace_minutes: minuteLogRef.current,
            sprint_minutes: Array.from(sprintMinutesRef.current),
          })
          .select()
          .single();
        if (!error && data) setRuns((r) => [data, ...r]);
        else if (error) console.error("Failed to save run:", error);
      }
      onResetRun();
      setActiveTab("summary");
    },
    [tracker, sprintIdx, cadence, hr, speedMph, onResetRun, paceSettings.workoutType]
  );

  // Mirror the watch's Start/Pause/Resume/Stop on the phone's own tracker —
  // the watch is the controller here, the phone just follows so its GPS
  // session (and the eventual Supabase save) actually runs alongside it.
  // Latest-value refs so the listener below can subscribe exactly once (native
  // event subscriptions are not free to tear down/recreate) while still
  // always acting on current tracker/callback state.
  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;
  const onChangeWorkoutTypeRef = useRef(onChangeWorkoutType);
  onChangeWorkoutTypeRef.current = onChangeWorkoutType;
  const onEndWorkoutRef = useRef(onEndWorkout);
  onEndWorkoutRef.current = onEndWorkout;

  useEffect(() => {
    const unsubscribe = addSessionEventListener(({ event, workoutType }) => {
      console.log("[watch] session event received:", event, workoutType);
      const tracker = trackerRef.current;
      if (event === "start") {
        if (workoutType && WORKOUT_TYPES[workoutType]) onChangeWorkoutTypeRef.current(workoutType);
        if (!tracker.isTracking) tracker.start();
        setActiveTab("live");
      } else if (event === "pause") {
        if (tracker.isTracking && !tracker.isPaused) tracker.pause();
      } else if (event === "resume") {
        if (tracker.isTracking && tracker.isPaused) tracker.resume();
      } else if (event === "stop") {
        if (tracker.isTracking) onEndWorkoutRef.current(null, { notifyWatch: false });
      }
    });
    return unsubscribe;
  }, []);

  // Fallback (and in practice, primary) start trigger: the moment real
  // telemetry packets start arriving from the watch, a run is definitely
  // active — this reuses the already-working RunPacket channel instead of
  // depending solely on the separate sessionEvent signal above.
  useEffect(() => {
    // A fresh packet proves the watch workout is active even when
    // WCSession.isReachable is false. Reachability only describes whether
    // immediate sendMessage delivery is available; application-context
    // telemetry can still arrive while it is false.
    if (watch.packetCount > 0 && watch.lastPacket) {
      if (!trackerRef.current.isTracking) {
        trackerRef.current.start();
        setActiveTab("live");
      }
      trackerRef.current.syncElapsed(watch.lastPacket.elapsedSeconds);
    }
  }, [watch.packetCount, watch.lastPacket]);

  const onPhonePause = useCallback(() => {
    tracker.pause();
    sendSessionCommand("pause");
  }, [tracker.pause]);

  const onPhoneResume = useCallback(() => {
    tracker.resume();
    sendSessionCommand("resume");
  }, [tracker.resume]);

  // Stop the Watch immediately after the phone's second confirmation tap.
  // Saving waits for the optional RPE selection, but both workout clocks stop now.
  const onPhoneStopRequested = useCallback(() => {
    if (tracker.isTracking && !tracker.isPaused) tracker.pause();
    sendSessionCommand("stop");
  }, [tracker.isTracking, tracker.isPaused, tracker.pause]);

  const onFinishPhoneWorkout = useCallback(
    (rpe) => onEndWorkout(rpe, { notifyWatch: false }),
    [onEndWorkout]
  );

  const onPhoneReset = useCallback(() => {
    sendSessionCommand("stop");
    onResetRun();
  }, [onResetRun]);

  // AI: single call returning all outputs
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
        coreCompleted > 0
          ? `Current core progress: ${coreCompleted}/${CORE_GOAL} exercises completed.`
          : "No core exercises completed yet.";
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
  }, [cycleDay, coreCompleted, history, vo2History]);
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
  else if (achievementsPresented)
    body = (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <AchievementsScreen
          ctx={achievementContext({ readiness, coreCompleted, history, streaks, confidence: confidenceScore })}
          onBack={() => setAchievementsPresented(false)}
        />
      </ScrollView>
    );
  else if (trainingLoadPresented)
    body = (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <TrainingLoadScreen
          readiness={readiness}
          rpeLog={rpeLog}
          history={history}
          confidenceScore={confidenceScore}
          onBack={() => setTrainingLoadPresented(false)}
        />
      </ScrollView>
    );
  else if (formPresented)
    body = (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <FormScreen session={history[0] ?? null} onBack={() => setFormPresented(false)} />
      </ScrollView>
    );
  else if (devicesPresented)
    body = (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <DevicesScreen
          onBack={() => setDevicesPresented(false)}
          watchPaired={watch.paired}
          watchConnected={watch.connected}
          watchDebug={watch}
        />
      </ScrollView>
    );
  else if (profilePresented)
    body = (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <ProfileScreen
          profile={profile}
          onChangeSex={(v) => updateProfile({ sex: v })}
          onChangeBirthMonth={(v) => updateProfile({ birthMonth: v })}
          onChangeBirthYear={(v) => updateProfile({ birthYear: v })}
          onBack={() => setProfilePresented(false)}
        />
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
              sex={profile.sex}
              cycleDay={cycleDay}
              cycleLength={cycleLength}
              openCycle={() => setCyclePresented(true)}
              openRecovery={() => setRecoveryPresented(true)}
              openAchievements={() => setAchievementsPresented(true)}
              openTrainingLoad={() => setTrainingLoadPresented(true)}
              openForm={() => setFormPresented(true)}
              openDevices={() => setDevicesPresented(true)}
              openProfile={() => setProfilePresented(true)}
              achievementCtx={achievementContext({ readiness, coreCompleted, history, streaks, confidence: confidenceScore })}
              history={history}
              todayStats={todayStats}
              weekBars={weekBars}
              dataSourceLabel={
                history[0]?.groundContactTime > 0 || history[0]?.verticalOscillation > 0
                  ? "Supabase · Apple Watch + GPS"
                  : history.length
                    ? "Supabase · Phone GPS"
                    : "Supabase · No workouts yet"
              }
              onSignOut={onSignOut}
            />
          )}
          {activeTab === "live" && (
            <LiveScreen
              cues={cues}
              elapsedSeconds={tracker.elapsedSeconds}
              distanceMiles={tracker.distanceMiles}
              currentPace={tracker.currentPace}
              targetPace={tracker.targetPace}
              diffSecondsPerMile={tracker.diffSecondsPerMile}
              status={tracker.status}
              signalLost={tracker.signalLost}
              permissionStatus={tracker.permissionStatus}
              isTracking={tracker.isTracking}
              isPaused={tracker.isPaused}
              cadence={cadence}
              hr={hr}
              speedMph={speedMph}
              watchConnected={watch.connected}
              watchMetrics={watchMetrics}
              sprintIdx={sprintIdx}
              laps={laps}
              workoutType={paceSettings.workoutType}
              goalPaceSecPerMile={paceSettings.goalPaceSecPerMile}
              warmupSeconds={paceSettings.warmupSeconds}
              onChangeWorkoutType={onChangeWorkoutType}
              onChangeGoalPace={(v) => updatePaceSettings({ goalPaceSecPerMile: v })}
              onChangeWarmup={(v) => updatePaceSettings({ warmupSeconds: v })}
              onStart={tracker.start}
              onPause={onPhonePause}
              onResume={onPhoneResume}
              onReset={onPhoneReset}
              onRequestPermission={tracker.requestPermission}
              onLap={onLap}
              onStopRequested={onPhoneStopRequested}
              onEndWorkout={onFinishPhoneWorkout}
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
              paceMinutes={trendLatestRun?.paceMinutes || []}
              sprintMinutes={trendLatestRun?.sprintMinutes || new Set()}
              vo2History={trendVo2History}
              vo2Labels={trendVo2Labels}
              trendType={trendType}
              onChangeTrendType={setTrendType}
            />
          )}
          {activeTab === "history" && (
            <History
              history={trendHistory}
              monthlyHistory={trendMonthlyHistory}
              trendType={trendType}
              onChangeTrendType={setTrendType}
            />
          )}
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

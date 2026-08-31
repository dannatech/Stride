import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { T, card } from "./theme";
import { Eyebrow, BreathingGuide, StatCard } from "./components";
import { SPRINT_GOAL, estimateVO2, fmtClock, fmtPace } from "./data";
import type { PaceStatus } from "./usePaceTracker";

const STATUS_COLOR: Record<PaceStatus, string> = {
  "on-pace": T.accent1, // green
  "too-fast": T.amber, // orange
  "too-slow": T.accent2, // blue
};

const STATUS_LABEL: Record<PaceStatus, string> = {
  "on-pace": "On Pace",
  "too-fast": "Too Fast",
  "too-slow": "Too Slow",
};

function fmtDiff(diffSecondsPerMile: number): string {
  if (diffSecondsPerMile === 0) return "on target";
  const sign = diffSecondsPerMile > 0 ? "+" : "−";
  return `${sign}${Math.round(Math.abs(diffSecondsPerMile))}s/mi`;
}

interface LiveScreenProps {
  cues: string[];
  elapsedSeconds: number;
  distanceMiles: number;
  currentPace: number;
  targetPace: number;
  diffSecondsPerMile: number;
  status: PaceStatus;
  signalLost: boolean;
  permissionStatus: string;
  isTracking: boolean;
  isPaused: boolean;
  cadence: number;
  hr: number;
  speedMph: number;
  watchConnected: boolean;
  watchMetrics: { groundContactTime: number; verticalOscillation: number; power: number } | null;
  sprintIdx: number;
  laps: number[];
  goalPaceSecPerMile: number;
  warmupSeconds: number;
  onChangeGoalPace: (v: number) => void;
  onChangeWarmup: (v: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onRequestPermission: () => void;
  onLap: () => void;
  onEndWorkout: (rpe: number | null) => void;
}

export function LiveScreen({
  cues,
  elapsedSeconds,
  distanceMiles,
  currentPace,
  targetPace,
  diffSecondsPerMile,
  status,
  signalLost,
  permissionStatus,
  isTracking,
  isPaused,
  cadence,
  hr,
  speedMph,
  watchConnected,
  watchMetrics,
  sprintIdx,
  laps,
  goalPaceSecPerMile,
  warmupSeconds,
  onChangeGoalPace,
  onChangeWarmup,
  onStart,
  onPause,
  onResume,
  onReset,
  onRequestPermission,
  onLap,
  onEndWorkout,
}: LiveScreenProps) {
  const cue = cues[Math.floor(elapsedSeconds / 8) % cues.length];

  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [showRpe, setShowRpe] = useState(false);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
  }, []);

  const handleEndPress = () => {
    if (!confirmingEnd) {
      setConfirmingEnd(true);
      confirmTimeout.current = setTimeout(() => setConfirmingEnd(false), 3000);
      return;
    }
    if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
    setConfirmingEnd(false);
    setShowRpe(true);
  };
  const finishWithRpe = (rpe: number | null) => {
    setShowRpe(false);
    onEndWorkout(rpe);
  };

  if (permissionStatus === "denied") {
    return (
      <View style={{ gap: 16, alignItems: "center", marginTop: 60, paddingHorizontal: 12 }}>
        <Eyebrow color={T.red}>Location Access Needed</Eyebrow>
        <Text style={{ fontSize: 18, fontWeight: "700", color: T.ink, textAlign: "center" }}>
          Stride needs GPS to track your pace
        </Text>
        <Text style={{ fontSize: 13, color: T.sub, textAlign: "center", maxWidth: 280 }}>
          Location access was denied. Enable it for Stride in your device Settings, then come back and try again.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          style={{ marginTop: 8, backgroundColor: T.accent1, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Open Settings</Text>
        </Pressable>
        <Pressable onPress={onRequestPermission}>
          <Text style={{ color: T.sub, fontWeight: "600", fontSize: 13 }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (showRpe) {
    return (
      <View style={{ gap: 16 }}>
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Eyebrow>Workout Complete</Eyebrow>
          <Text style={{ fontSize: 20, fontWeight: "700", color: T.ink, marginTop: 6 }}>How hard did that feel?</Text>
          <Text style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>Rate your perceived effort, 1–10</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Pressable
              key={n}
              onPress={() => finishWithRpe(n)}
              style={{
                width: "18%",
                aspectRatio: 1,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: T.hair,
                backgroundColor: T.cardBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: T.ink, fontWeight: "700", fontSize: 15 }}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 }}>
          <Text style={{ fontSize: 10, color: T.sub }}>Very easy</Text>
          <Text style={{ fontSize: 10, color: T.sub }}>Max effort</Text>
        </View>
        <Pressable onPress={() => finishWithRpe(null)} style={{ marginTop: 8 }}>
          <Text style={{ color: T.sub, fontSize: 13, fontWeight: "600" }}>Skip</Text>
        </Pressable>
      </View>
    );
  }

  if (!isTracking) {
    return (
      <View style={{ gap: 16, alignItems: "center", marginTop: 40 }}>
        <Eyebrow color={T.sub}>Ready</Eyebrow>
        <Text style={{ fontSize: 20, fontWeight: "700", color: T.ink, textAlign: "center" }}>
          Start your run when you're ready
        </Text>
        <Text style={{ fontSize: 12, color: T.sub, textAlign: "center", maxWidth: 260 }}>
          Pace and distance are tracked live via GPS. Set a goal pace and warm-up length below.
        </Text>

        <View style={card({ padding: 16, width: "100%" })}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: T.ink }}>Goal Pace</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable onPress={() => onChangeGoalPace(Math.max(240, goalPaceSecPerMile - 5))} hitSlop={8}>
                <Text style={{ color: T.accent1, fontSize: 18, fontWeight: "800" }}>−</Text>
              </Pressable>
              <Text style={{ color: T.ink, fontWeight: "700", fontSize: 14, minWidth: 64, textAlign: "center" }}>
                {fmtPace(goalPaceSecPerMile)} /mi
              </Text>
              <Pressable onPress={() => onChangeGoalPace(Math.min(1200, goalPaceSecPerMile + 5))} hitSlop={8}>
                <Text style={{ color: T.accent1, fontSize: 18, fontWeight: "800" }}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: T.ink }}>Warm-up</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable onPress={() => onChangeWarmup(Math.max(0, warmupSeconds - 30))} hitSlop={8}>
                <Text style={{ color: T.accent1, fontSize: 18, fontWeight: "800" }}>−</Text>
              </Pressable>
              <Text style={{ color: T.ink, fontWeight: "700", fontSize: 14, minWidth: 64, textAlign: "center" }}>
                {Math.round(warmupSeconds / 60)} min
              </Text>
              <Pressable onPress={() => onChangeWarmup(Math.min(1800, warmupSeconds + 30))} hitSlop={8}>
                <Text style={{ color: T.accent1, fontSize: 18, fontWeight: "800" }}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable
          onPress={onStart}
          style={{
            marginTop: 12,
            width: 140,
            height: 140,
            borderRadius: 999,
            backgroundColor: T.accent1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>Start Run</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isPaused ? T.amber : T.accent1 }} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: T.sub }}>
          {isPaused ? "Paused" : "GPS Tracking"}
          {watchConnected ? " · ⌚ Watch Connected" : ""}
        </Text>
      </View>

      <View style={card({ paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" })}>
        <Text style={{ fontSize: 13, fontStyle: "italic", color: T.ink, textAlign: "center" }}>"{cue}"</Text>
      </View>

      <BreathingGuide hr={hr} compact />

      <View style={{ alignItems: "center" }}>
        <Eyebrow color={T.sub}>Elapsed</Eyebrow>
        <Text style={{ fontSize: 52, fontWeight: "800", color: T.ink, fontVariant: ["tabular-nums"], lineHeight: 58 }}>
          {fmtClock(elapsedSeconds)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}>
          <Text style={{ fontSize: 38, fontWeight: "800", color: T.accent1 }}>{distanceMiles.toFixed(2)}</Text>
          <Text style={{ fontSize: 15, color: T.sub, marginLeft: 4, marginBottom: 4 }}>mi</Text>
        </View>
      </View>

      {signalLost ? (
        <View style={[card({ padding: 14, alignItems: "center" }), { backgroundColor: `${T.amber}26` }]}>
          <Text style={{ color: T.amber, fontWeight: "700", fontSize: 14 }}>Signal Lost</Text>
          <Text style={{ color: T.sub, fontSize: 11, marginTop: 2, textAlign: "center" }}>
            No GPS fix for 10+ seconds. Move to open sky for a reading.
          </Text>
        </View>
      ) : (
        <View style={[card({ padding: 14, alignItems: "center" }), { backgroundColor: `${STATUS_COLOR[status]}26` }]}>
          <Text style={{ color: STATUS_COLOR[status], fontWeight: "800", fontSize: 15 }}>{STATUS_LABEL[status]}</Text>
          <Text style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{fmtDiff(diffSecondsPerMile)} vs. target</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: T.sub }}>Current Pace</Text>
          <Text style={{ fontSize: 30, fontWeight: "800", color: T.ink }}>
            {signalLost || currentPace === 0 ? "—:—" : fmtPace(currentPace)}
          </Text>
          <Text style={{ fontSize: 11, color: T.sub }}>/mi</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: T.sub }}>Target Pace</Text>
          <Text style={{ fontSize: 30, fontWeight: "800", color: T.sub }}>{fmtPace(targetPace)}</Text>
          <Text style={{ fontSize: 11, color: T.sub }}>/mi</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ width: "48%" }}>
          <StatCard value={signalLost ? "—" : `${speedMph.toFixed(1)} mph`} label="Speed" />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={`${Math.round(cadence)} spm`} label="Cadence" />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={`${Math.round(hr)} bpm`} label="Heart Rate" valueColor={T.red} />
        </View>
        <View style={{ width: "48%" }}>
          <StatCard value={signalLost ? "—" : estimateVO2(speedMph).toFixed(1)} label="Est. VO2 (ml/kg/min)" valueColor={T.accent2} />
        </View>
      </View>

      {watchConnected && watchMetrics && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <View style={{ width: "31%" }}>
            <StatCard value={`${Math.round(watchMetrics.groundContactTime)} ms`} label="Ground Contact" valueColor={T.accent2} />
          </View>
          <View style={{ width: "31%" }}>
            <StatCard value={`${watchMetrics.verticalOscillation.toFixed(1)} cm`} label="Vert. Oscillation" valueColor={T.accent2} />
          </View>
          <View style={{ width: "31%" }}>
            <StatCard value={`${Math.round(watchMetrics.power)} W`} label="Running Power" valueColor={T.accent2} />
          </View>
        </View>
      )}

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

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={onLap}
          disabled={isPaused}
          style={{ flex: 1, backgroundColor: T.accent1, borderRadius: 999, paddingVertical: 11, alignItems: "center", opacity: isPaused ? 0.5 : 1 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Lap</Text>
        </Pressable>
        <Pressable
          onPress={isPaused ? onResume : onPause}
          style={{
            flex: 1,
            backgroundColor: isPaused ? T.amber : "transparent",
            borderWidth: isPaused ? 0 : 1.5,
            borderColor: T.hair,
            borderRadius: 999,
            paddingVertical: 11,
            alignItems: "center",
          }}
        >
          <Text style={{ color: isPaused ? "#111214" : T.ink, fontWeight: "700", fontSize: 13 }}>
            {isPaused ? "Resume" : "Pause"}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleEndPress}
          style={{
            flex: 1,
            backgroundColor: confirmingEnd ? T.red : "transparent",
            borderWidth: 1.5,
            borderColor: T.red,
            borderRadius: 999,
            paddingVertical: 11,
            alignItems: "center",
          }}
        >
          <Text style={{ color: confirmingEnd ? "#fff" : T.red, fontWeight: "700", fontSize: 13 }}>
            {confirmingEnd ? "Tap to Confirm" : "End Workout"}
          </Text>
        </Pressable>
      </View>

      {isPaused && (
        <Pressable onPress={onReset} style={{ alignItems: "center" }}>
          <Text style={{ color: T.sub, fontSize: 12, fontWeight: "600" }}>Reset Run</Text>
        </Pressable>
      )}

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

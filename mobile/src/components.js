import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";

const AnimatedG = Animated.createAnimatedComponent(G);
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { T, card } from "./theme";
import { hrZoneFor, TIER_STYLE } from "./data";

/* ───────── small shared components ───────── */

export function Eyebrow({ children, color = T.accent1 }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.9,
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </Text>
  );
}

export function Chevron({ dir = "right", color = T.sub, size = 12 }) {
  const rot = { right: 45, left: 225, up: -45, down: 135 }[dir];
  return (
    <View
      style={{
        width: size * 0.6,
        height: size * 0.6,
        borderTopWidth: 2,
        borderTopColor: color,
        borderRightWidth: 2,
        borderRightColor: color,
        transform: [{ rotate: `${rot}deg` }],
      }}
    />
  );
}

export function Logomark({ size = 72, radius = 22, fontSize = 32 }) {
  return (
    <LinearGradient
      colors={[T.accent1, T.accent2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize }}>S</Text>
    </LinearGradient>
  );
}

export function RunningLegs({ size = 90, color = T.accent1 }) {
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(swing, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [swing]);

  const frontRotation = swing.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] });
  const backRotation = swing.interpolate({ inputRange: [0, 1], outputRange: [30, -30] });

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <AnimatedG origin="50,36" rotation={backRotation}>
        <Path d="M50 36 L38 68 L30 94 L42 94 L52 68 L56 36 Z" fill={color} opacity={0.5} />
      </AnimatedG>
      <AnimatedG origin="50,36" rotation={frontRotation}>
        <Path d="M50 36 L62 68 L70 94 L58 94 L48 68 L44 36 Z" fill={color} />
      </AnimatedG>
      <Circle cx="50" cy="22" r="10" fill={color} />
    </Svg>
  );
}

export function BackHeader({ title, onBack }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 8 }}>
      <Pressable
        onPress={onBack}
        accessibilityLabel="Back"
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: T.cardBg,
          borderWidth: 1,
          borderColor: T.hair,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Chevron dir="left" color={T.ink} />
      </Pressable>
      <Text style={{ fontSize: 20, fontWeight: "700", color: T.ink }}>{title}</Text>
    </View>
  );
}

export function StatCard({ value, label, valueColor = T.ink }) {
  return (
    <View style={card({ paddingVertical: 14, paddingHorizontal: 12, alignItems: "center", flex: 1 })}>
      <Text style={{ fontSize: 17, fontWeight: "700", color: valueColor }}>{value}</Text>
      <Text style={{ fontSize: 11, color: T.sub, marginTop: 3, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

/* ───────── Progress ring ───────── */

export function ProgressRing({ value, goal, unit = "sprints" }) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / goal);
  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={T.accent1} />
            <Stop offset="100%" stopColor={T.accent2} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.hair} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c}, ${c}`}
          strokeDashoffset={c * (1 - pct)}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 40, fontWeight: "800", color: T.ink, lineHeight: 44 }}>{value}</Text>
        <Text style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>of {goal} {unit}</Text>
      </View>
    </View>
  );
}

/* ───────── HR zone & breathing guidance ───────── */

export function BreathingGuide({ hr, compact = false }) {
  const z = hrZoneFor(hr);
  const duration = { 1: 16, 2: 6, 3: 4, 4: 3, 5: 2 }[z.zone];
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: (duration * 1000) / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: (duration * 1000) / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [duration]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={card({ padding: compact ? 14 : 16, flexDirection: "row", alignItems: "center", gap: 14 })}>
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: `${z.color}33`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: z.color,
            transform: [{ scale }],
            opacity,
          }}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Eyebrow color={z.color}>Zone {z.zone} · {z.name}</Eyebrow>
        <Text style={{ fontSize: 13, fontWeight: "700", color: T.ink, marginTop: 2 }}>{z.pattern}</Text>
        {!compact && <Text style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>{z.cue}</Text>}
      </View>
      <Text style={{ fontSize: 13, fontWeight: "700", color: T.ink }}>{Math.round(hr)} bpm</Text>
    </View>
  );
}

/* ───────── Core exercises ───────── */

export function RoundBtn({ children, onPress, filled }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 36,
        height: 32,
        borderRadius: 10,
        borderWidth: filled ? 0 : 1,
        borderColor: T.hair,
        backgroundColor: filled ? T.accent1 : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: filled ? "#fff" : T.ink, fontWeight: "700", fontSize: 12 }}>{children}</Text>
    </Pressable>
  );
}

export function CoreExerciseRow({ ex, logged, isHolding, holdElapsed, onLogReps, onStartHold, onStopHold }) {
  const displayVal = ex.type === "hold" && isHolding ? holdElapsed : logged;
  const done = displayVal >= ex.target;
  return (
    <View style={card({ padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 })}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>{ex.name}</Text>
          {done && <Text style={{ fontSize: 10, fontWeight: "700", color: T.accent1 }}>✓ DONE</Text>}
        </View>
        <Text style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
          {displayVal}/{ex.target} {ex.unit}
        </Text>
      </View>
      {ex.type === "reps" ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <RoundBtn onPress={() => onLogReps(ex.id, -5)}>−5</RoundBtn>
          <RoundBtn onPress={() => onLogReps(ex.id, 5)} filled>
            +5
          </RoundBtn>
        </View>
      ) : (
        <Pressable
          onPress={() => (isHolding ? onStopHold(ex.id) : onStartHold(ex.id))}
          style={{
            backgroundColor: isHolding ? T.red : T.accent1,
            borderRadius: 999,
            paddingVertical: 10,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{isHolding ? "Stop" : "Start"}</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ───────── gamification components ───────── */

export function AchievementBadge({ achievement, unlocked, ctx, onPress }) {
  const tier = TIER_STYLE[achievement.tier];
  const prog = !unlocked && achievement.progress ? achievement.progress(ctx) : null;
  const pct = prog ? Math.min(1, prog.invert ? prog.target / Math.max(prog.current, 1) : prog.current / prog.target) : 0;
  return (
    <Pressable
      onPress={onPress}
      style={card({
        padding: 14,
        opacity: unlocked ? 1 : 0.55,
        shadowColor: unlocked && tier.glow ? tier.color : "#000",
        shadowOpacity: unlocked && tier.glow ? 0.6 : 0.35,
        shadowRadius: unlocked && tier.glow ? 16 : 24,
        borderWidth: unlocked && tier.glow ? 1 : 0,
        borderColor: tier.color,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: unlocked ? `${tier.color}22` : T.hair,
            borderWidth: 1.5,
            borderColor: unlocked ? tier.color : T.hair,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 16 }}>{unlocked ? (achievement.tier === "legendary" ? "★" : "●") : "🔒"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: T.ink }}>{achievement.name}</Text>
            <Text style={{ fontSize: 9, fontWeight: "700", color: tier.color, textTransform: "uppercase" }}>{tier.label}</Text>
          </View>
          <Text style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{achievement.desc}</Text>
          {prog && (
            <View style={{ height: 4, backgroundColor: T.hair, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
              <View style={{ height: "100%", width: `${pct * 100}%`, backgroundColor: tier.color, borderRadius: 2 }} />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function TierPill({ tier }) {
  const t = TIER_STYLE[tier];
  return (
    <View style={{ borderWidth: 1, borderColor: t.color, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: t.color, textTransform: "uppercase" }}>{t.label}</Text>
    </View>
  );
}

/* ───────── Tab bar ───────── */

export const TABS = [
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
      return <View style={{ width: s, height: s, borderRadius: s / 2, borderWidth: 2, borderColor: color }} />;
    case "live":
      return (
        <View
          style={{
            width: 0,
            height: 0,
            borderTopWidth: 7,
            borderBottomWidth: 7,
            borderLeftWidth: 11,
            borderTopColor: "transparent",
            borderBottomColor: "transparent",
            borderLeftColor: color,
          }}
        />
      );
    case "core":
      return (
        <View style={{ gap: 2 }}>
          <View style={{ width: 14, height: 2.5, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: 14, height: 2.5, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: 14, height: 2.5, backgroundColor: color, borderRadius: 1 }} />
        </View>
      );
    case "pace":
      return (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: s }}>
          <View style={{ width: 3, height: 7, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: 3, height: 12, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: 3, height: 9, backgroundColor: color, borderRadius: 1 }} />
        </View>
      );
    case "history":
      return (
        <View style={{ width: s, height: s, borderRadius: s / 2, borderWidth: 2, borderColor: color }}>
          <View style={{ position: "absolute", left: "45%", top: 2, width: 2, height: 5, backgroundColor: color }} />
          <View style={{ position: "absolute", left: "45%", top: "42%", width: 5, height: 2, backgroundColor: color }} />
        </View>
      );
    case "coach":
      return <View style={{ width: 11, height: 11, backgroundColor: color, transform: [{ rotate: "45deg" }], borderRadius: 2 }} />;
    default:
      return null;
  }
}

export function TabBar({ active, setActive, bottomInset = 0 }) {
  return (
    <View
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        bottom: 10 + bottomInset,
        borderRadius: 26,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: T.hair,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 8,
      }}
    >
      <BlurView intensity={60} tint="dark" style={{ flexDirection: "row", padding: 6, backgroundColor: "rgba(27,29,32,0.72)" }}>
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setActive(t.id)}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 4,
                paddingTop: 8,
                paddingBottom: 6,
                borderRadius: 20,
                backgroundColor: on ? T.pillActiveBg : "transparent",
              }}
            >
              <TabIcon id={t.id} color={on ? T.accent1 : T.sub} />
              <Text style={{ fontSize: 10, fontWeight: on ? "700" : "500", color: on ? T.accent1 : T.sub }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

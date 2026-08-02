import { requireNativeModule, requireOptionalNativeModule } from "expo-modules-core";

// `requireOptionalNativeModule` avoids a hard crash on platforms where the
// native module isn't linked (Android, Expo Go, web) — every export below
// falls back to a no-op so App.js can call this unconditionally.
const native = requireOptionalNativeModule("StrideWatchConnectivity");

/**
 * Pushes the current app state snapshot down to the paired Apple Watch app
 * over WatchConnectivity. Call this whenever session/ai/readiness/cycle/core
 * state changes — see mobile/App.js.
 */
export function sendWatchUpdate(payload) {
  native?.sendUpdate(payload);
}

export function isWatchSupported() {
  return native?.isSupported() ?? false;
}

export function isWatchPaired() {
  return native?.isPaired() ?? false;
}

/**
 * Subscribes to actions sent *from* the watch (Lap, log reps, log period,
 * etc.). Returns an unsubscribe function.
 */
export function addWatchActionListener(listener) {
  if (!native) return () => {};
  const subscription = native.addListener("onWatchAction", listener);
  return () => subscription.remove();
}

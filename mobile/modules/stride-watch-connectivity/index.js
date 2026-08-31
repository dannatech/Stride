import { requireOptionalNativeModule } from "expo-modules-core";

// `requireOptionalNativeModule` avoids a hard crash on platforms where the
// native module isn't linked (Android, Expo Go, web) — every export below
// falls back to a no-op/false so App.js can call this unconditionally.
const native = requireOptionalNativeModule("StrideWatchConnectivity");

export function isWatchSupported() {
  return native?.isSupported() ?? false;
}

export function isWatchPaired() {
  return native?.isPaired() ?? false;
}

export function isWatchAppInstalled() {
  return native?.isWatchAppInstalled() ?? false;
}

export function isWatchReachable() {
  return native?.isReachable() ?? false;
}

export function getLastRunPacket() {
  return native?.getLastPacket() ?? null;
}

/**
 * Fires with a RunPacket-shaped object (see watch/StrideWatchApp/RunPacket.swift)
 * whenever the watch pushes new run telemetry. Returns an unsubscribe function.
 */
export function addRunPacketListener(listener) {
  if (!native) return () => {};
  const subscription = native.addListener("onRunPacket", listener);
  return () => subscription.remove();
}

/**
 * Fires with { isPaired, isWatchAppInstalled, isReachable } whenever the
 * watch's pairing/install/reachability state changes.
 */
export function addReachabilityListener(listener) {
  if (!native) return () => {};
  const subscription = native.addListener("onReachabilityChange", listener);
  return () => subscription.remove();
}

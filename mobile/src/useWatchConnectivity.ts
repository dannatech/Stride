import { useEffect, useRef, useState } from "react";
import {
  addRunPacketListener,
  addReachabilityListener,
  isWatchSupported,
  isWatchPaired,
  isWatchAppInstalled,
  isWatchReachable,
  getLastRunPacket,
} from "../modules/stride-watch-connectivity";

// Mirrors watch/StrideWatchApp/RunPacket.swift's `asDictionary`.
export interface WatchRunPacket {
  pace: number; // seconds per mile, 0 if the watch has no fix yet
  lat: number;
  lon: number;
  heartRate: number; // bpm, from HealthKit
  groundContactTime: number; // ms
  verticalOscillation: number; // cm
  strideLength: number; // meters
  power: number; // watts
  elapsedSeconds: number;
}

export interface WatchConnectivityState {
  supported: boolean;
  paired: boolean;
  appInstalled: boolean;
  reachable: boolean;
  lastPacket: WatchRunPacket | null;
  // reachable AND a packet has arrived recently — the signal to actually
  // trust and display watch data, vs. just "a watch happens to be nearby".
  connected: boolean;
}

// WorkoutManager sends roughly every 2s while a run is active; three missed
// beats is a reasonable "the watch app stopped/was killed" cutoff.
const STALE_MS = 6000;

export function useWatchConnectivity(): WatchConnectivityState {
  const supported = useRef(isWatchSupported()).current;
  const [paired, setPaired] = useState(() => (supported ? isWatchPaired() : false));
  const [appInstalled, setAppInstalled] = useState(() => (supported ? isWatchAppInstalled() : false));
  const [reachable, setReachable] = useState(() => (supported ? isWatchReachable() : false));
  const [lastPacket, setLastPacket] = useState<WatchRunPacket | null>(() =>
    supported ? getLastRunPacket() : null
  );
  const [lastPacketAt, setLastPacketAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!supported) return;
    const unsubPacket = addRunPacketListener((packet: WatchRunPacket) => {
      setLastPacket(packet);
      setLastPacketAt(Date.now());
    });
    const unsubReach = addReachabilityListener(
      (state: { isPaired: boolean; isWatchAppInstalled: boolean; isReachable: boolean }) => {
        setPaired(state.isPaired);
        setAppInstalled(state.isWatchAppInstalled);
        setReachable(state.isReachable);
      }
    );
    return () => {
      unsubPacket();
      unsubReach();
    };
  }, [supported]);

  // Tick so `connected` can flip false a few seconds after packets stop
  // arriving, even with no new native event to trigger a re-render.
  useEffect(() => {
    if (!supported) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [supported]);

  const connected = supported && reachable && lastPacketAt > 0 && now - lastPacketAt < STALE_MS;

  return { supported, paired, appInstalled, reachable, lastPacket, connected };
}

import { useEffect, useRef, useState } from "react";
import {
  addRunPacketListener,
  addSessionEventListener,
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
  // Debug/diagnostic counters — how many of each thing has ever arrived
  // this app session, and the raw text of the last session event, so a
  // "nothing is arriving at all" question can be answered by eye.
  packetCount: number;
  sessionEventCount: number;
  lastSessionEvent: string | null;
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
  const [packetCount, setPacketCount] = useState(0);
  const [sessionEventCount, setSessionEventCount] = useState(0);
  const [lastSessionEvent, setLastSessionEvent] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    const unsubPacket = addRunPacketListener((packet: WatchRunPacket) => {
      setLastPacket(packet);
      setLastPacketAt(Date.now());
      setPacketCount((n) => n + 1);
    });
    const unsubSessionEvent = addSessionEventListener(
      (payload: { event: string; workoutType?: string }) => {
        setSessionEventCount((n) => n + 1);
        setLastSessionEvent(`${payload.event}${payload.workoutType ? ` (${payload.workoutType})` : ""}`);
      }
    );
    const unsubReach = addReachabilityListener(
      (state: { isPaired: boolean; isWatchAppInstalled: boolean; isReachable: boolean }) => {
        setPaired(state.isPaired);
        setAppInstalled(state.isWatchAppInstalled);
        setReachable(state.isReachable);
      }
    );
    return () => {
      unsubPacket();
      unsubSessionEvent();
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

  return {
    supported,
    paired,
    appInstalled,
    reachable,
    lastPacket,
    connected,
    packetCount,
    sessionEventCount,
    lastSessionEvent,
  };
}

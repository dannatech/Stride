import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";

export type PaceStatus = "on-pace" | "too-fast" | "too-slow";

export interface PaceTrackerState {
  elapsedSeconds: number;
  distanceMiles: number;
  currentPace: number; // seconds per mile; 0 until enough GPS samples exist
  targetPace: number; // seconds per mile
  diffSecondsPerMile: number; // currentPace - targetPace (negative = ahead of target)
  status: PaceStatus;
  signalLost: boolean;
  permissionStatus: Location.PermissionStatus | "undetermined";
  isTracking: boolean;
  isPaused: boolean;
}

export interface PaceTrackerControls {
  start: () => Promise<void>;
  syncElapsed: (seconds: number) => void;
  pause: () => void;
  resume: () => Promise<void>;
  reset: () => void;
  requestPermission: () => Promise<Location.PermissionStatus>;
}

const ROLLING_WINDOW_MS = 15000;
const SIGNAL_LOST_MS = 10000;
const ON_PACE_THRESHOLD_SEC = 8;
const MIN_ACCURACY_METERS = 30; // ignore fixes noisier than this
const MAX_PLAUSIBLE_SEGMENT_MILES = 0.5; // guard against wild GPS jumps between fixes

// expo-location's web platform shim can throw when tearing down a subscription
// (LocationEventEmitter.web.js lacks removeSubscription); never let that surface
// as an uncaught error on top of a real GPS run.
function safeRemoveSubscription(sub: Location.LocationSubscription | null) {
  try {
    sub?.remove();
  } catch {
    // ignore — subscription cleanup best-effort
  }
}

const EARTH_RADIUS_MILES = 3958.7613;
const toRad = (deg: number) => (deg * Math.PI) / 180;

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

// Cadence/HR have no real sensor in this app (phone GPS only) — this is the same
// illustrative warm-up ramp used before, now driven by the real GPS elapsed clock.
export function simulatedVitals(elapsedSeconds: number): { cadence: number; hr: number } {
  const warmup = 1 - Math.exp(-elapsedSeconds / 45);
  return {
    cadence: 140 + (172 - 140) * warmup + Math.sin(elapsedSeconds / 11) * 6 * warmup,
    hr: 68 + (158 - 68) * warmup + Math.sin(elapsedSeconds / 13) * 9 * warmup,
  };
}

function computeTargetPace(elapsedSeconds: number, goalPaceSecPerMile: number, warmupSeconds: number): number {
  if (warmupSeconds <= 0 || elapsedSeconds >= warmupSeconds) return goalPaceSecPerMile;
  const progress = elapsedSeconds / warmupSeconds;
  return goalPaceSecPerMile + 60 - 60 * progress;
}

type Sample = { t: number; cumDistMiles: number };
type Coord = { lat: number; lon: number };

export function usePaceTracker(goalPaceSecPerMile: number, warmupSeconds = 300): PaceTrackerState & PaceTrackerControls {
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | "undetermined">(
    "undetermined"
  );
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [currentPace, setCurrentPace] = useState(0);
  const [signalLost, setSignalLost] = useState(false);

  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastCoordRef = useRef<Coord | null>(null);
  const lastFixAtRef = useRef(0);
  const cumDistRef = useRef(0);
  const samplesRef = useRef<Sample[]>([]);

  const requestPermission = useCallback(async (): Promise<Location.PermissionStatus> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    return status;
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const handleLocationUpdate = useCallback((loc: Location.LocationObject) => {
    lastFixAtRef.current = Date.now();
    setSignalLost(false);

    const { latitude, longitude, accuracy } = loc.coords;
    if (accuracy != null && accuracy > MIN_ACCURACY_METERS) return;

    const prev = lastCoordRef.current;
    lastCoordRef.current = { lat: latitude, lon: longitude };
    if (!prev) return;

    const segmentMiles = haversineMiles(prev.lat, prev.lon, latitude, longitude);
    if (segmentMiles > MAX_PLAUSIBLE_SEGMENT_MILES) return;

    cumDistRef.current += segmentMiles;
    setDistanceMiles(cumDistRef.current);

    const t = loc.timestamp;
    samplesRef.current.push({ t, cumDistMiles: cumDistRef.current });
    const cutoff = t - ROLLING_WINDOW_MS;
    samplesRef.current = samplesRef.current.filter((s) => s.t >= cutoff);

    if (samplesRef.current.length >= 2) {
      const first = samplesRef.current[0];
      const last = samplesRef.current[samplesRef.current.length - 1];
      const dtSec = (last.t - first.t) / 1000;
      const ddMiles = last.cumDistMiles - first.cumDistMiles;
      if (dtSec > 0 && ddMiles > 0.0005) {
        setCurrentPace(dtSec / ddMiles);
      }
    }
  }, []);

  const startWatch = useCallback(async () => {
    let status = permissionStatus;
    if (status !== "granted") {
      status = await requestPermission();
      if (status !== "granted") return;
    }
    lastFixAtRef.current = Date.now();
    watchSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000 },
      handleLocationUpdate
    );
  }, [permissionStatus, requestPermission, handleLocationUpdate]);

  const start = useCallback(async () => {
    setIsTracking(true);
    setIsPaused(false);
    await startWatch();
  }, [startWatch]);

  // Reconcile the phone clock to the Watch's authoritative workout clock.
  // Packets arrive roughly every two seconds, while the local interval keeps
  // the UI ticking smoothly between reconciliations.
  const syncElapsed = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    setElapsedSeconds(Math.floor(seconds));
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    safeRemoveSubscription(watchSubRef.current);
    watchSubRef.current = null;
  }, []);

  const resume = useCallback(async () => {
    setIsPaused(false);
    await startWatch();
  }, [startWatch]);

  const reset = useCallback(() => {
    safeRemoveSubscription(watchSubRef.current);
    watchSubRef.current = null;
    setIsTracking(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setDistanceMiles(0);
    setCurrentPace(0);
    setSignalLost(false);
    cumDistRef.current = 0;
    samplesRef.current = [];
    lastCoordRef.current = null;
    lastFixAtRef.current = 0;
  }, []);

  // Elapsed clock + signal-loss watchdog — independent of GPS fix cadence.
  useEffect(() => {
    if (!isTracking || isPaused) return;
    const id = setInterval(() => {
      setElapsedSeconds((e) => e + 1);
      setSignalLost(Date.now() - lastFixAtRef.current > SIGNAL_LOST_MS);
    }, 1000);
    return () => clearInterval(id);
  }, [isTracking, isPaused]);

  useEffect(() => () => safeRemoveSubscription(watchSubRef.current), []);

  const targetPace = useMemo(
    () => computeTargetPace(elapsedSeconds, goalPaceSecPerMile, warmupSeconds),
    [elapsedSeconds, goalPaceSecPerMile, warmupSeconds]
  );

  const diffSecondsPerMile = currentPace > 0 ? currentPace - targetPace : 0;
  const status: PaceStatus =
    currentPace === 0 || Math.abs(diffSecondsPerMile) <= ON_PACE_THRESHOLD_SEC
      ? "on-pace"
      : diffSecondsPerMile < 0
        ? "too-fast"
        : "too-slow";

  return {
    elapsedSeconds,
    distanceMiles,
    currentPace,
    targetPace,
    diffSecondsPerMile,
    status,
    signalLost: isTracking && !isPaused && signalLost,
    permissionStatus,
    isTracking,
    isPaused,
    start,
    syncElapsed,
    pause,
    resume,
    reset,
    requestPermission,
  };
}

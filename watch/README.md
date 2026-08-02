# Stride watchOS Companion

SwiftUI source for an Apple Watch companion app that mirrors the phone app's
tabs (Summary, Live, Core, Pace, History, Coach, plus the Cycle/Recovery
drill-ins). The watch is a **thin client**: the iPhone app (`mobile/`) is the
only thing that talks to Supabase / the AI coach, and pushes state down to
the watch over `WatchConnectivity`. Button taps on the watch (Lap, log reps,
log period, …) are sent back to the phone, which owns the actual state and
re-pushes the updated snapshot.

This sandbox has no macOS/Xcode, so none of this has been built or run —
only written and syntax-reviewed. You'll need a Mac with Xcode to wire it up
and build it. `mobile/AGENTS.md` notes that Expo has changed recently —
cross-check the steps below against the versioned docs at
https://docs.expo.dev/versions/v57.0.0/ if anything here doesn't match what
Xcode/Expo actually offers you.

## What's here

```
watch/StrideWatch/
  StrideWatchApp.swift          @main entry point
  ContentView.swift             top-level TabView / auth-gate
  Theme.swift                   colors matching mobile/src/theme.js
  Models.swift                  Codable payload types + sample data (mirrors mobile/src/data.js)
  ConnectivityManager.swift     WCSession delegate; watch-side state store
  Components/Components.swift  StatTile, ProgressRingView, CoreExerciseRow, etc.
  Views/                        one SwiftUI view per phone-app screen

mobile/modules/stride-watch-connectivity/
  index.js                      sendWatchUpdate() / addWatchActionListener() for App.js
  ios/WatchBridge.swift          phone-side WCSession delegate (singleton)
  ios/StrideWatchConnectivityModule.swift   Expo Modules API wrapper
  ios/StrideWatchConnectivity.podspec
  expo-module.config.json       marks this as an autolinked local Expo module
```

`mobile/App.js` already imports `sendWatchUpdate` / `addWatchActionListener`
and pushes `{ authenticated, readiness, cycleDay, cycleLength, periodLength,
sprintsToday, coreToday, session, ai }` to the watch whenever that state
changes, and routes watch-originated actions (`lap`, `logReps`, `startHold`,
`stopHold`, `logPeriod`, `advanceDay`, `setSoreness`, `toggleStretch`) through
the same handlers the phone UI uses.

## Setting this up in Xcode

1. **Generate the native iOS project.** This repo runs Expo in managed
   workflow — there's no `ios/` folder checked in. From `mobile/`, run:
   ```
   npx expo prebuild -p ios
   ```
   This creates `mobile/ios/Stride.xcworkspace` and autolinks
   `modules/stride-watch-connectivity` (it has `expo-module.config.json`, so
   Expo's autolinking picks it up automatically — no extra config needed).

2. **Open the workspace**, not the `.xcodeproj`:
   ```
   open mobile/ios/Stride.xcworkspace
   ```

3. **Add the Watch App target.** File → New → Target… → watchOS → *App*.
   - Name it `StrideWatch`.
   - Interface: SwiftUI. Life Cycle: SwiftUI App.
   - When prompted for a companion app, choose the existing `Stride` iOS
     target — this embeds the watch app in the iPhone app's bundle, which is
     required for `WCSession` pairing to work.
   - Xcode will suggest a bundle id like `com.stride.app.watchkitapp` (must
     be the phone target's bundle id, `com.stride.app`, plus a suffix) —
     accept it.

4. **Replace the generated boilerplate.** Xcode scaffolds its own
   `ContentView.swift` / `StrideWatchApp.swift` for the new target — delete
   those and drag the entire `watch/StrideWatch/` folder from this repo into
   the new target in the project navigator. Make sure "Copy items if
   needed" is checked and target membership is set to the watch app target
   only (not the iOS target).

5. **Deployment target.** Set the watch target's deployment target to
   whatever the current watchOS version is at the time you build (check
   Xcode's SDK list) — nothing here uses APIs newer than the SwiftUI/
   WatchConnectivity basics, so it should build against recent watchOS
   without changes.

6. **No extra linking needed for WatchConnectivity** — it's a system
   framework on both the iOS and watchOS SDKs; `import WatchConnectivity`
   just works once the files are added to the right targets.

7. **Build and run.**
   - Run the `Stride` (iPhone) scheme on a simulator/device.
   - Run the `StrideWatch Watch App` scheme on a *paired* Watch simulator
     (Xcode → Window → Devices and Simulators, or just pick a paired
     iPhone+Watch combo in the scheme's run-destination picker).
   - Log in on the phone; the watch should flip from "Waiting for Stride…"
     to the tab view once the first `applicationContext` push lands.

## Design decisions worth knowing about

- **No login UI on the watch.** Typing an email/password on a watch is bad
  UX and unusual even in shipping apps — the watch shows a "open Stride on
  your iPhone" status screen until the phone reports `authenticated: true`.
- **Static reference data is duplicated, not synced.** Arrays like workout
  history, VO2max trend, and the core-exercise list are hardcoded in
  `Models.swift` exactly as in `mobile/src/data.js` (the phone app treats
  them as sample data too). Only genuinely dynamic state travels over
  WatchConnectivity — no reason to wire up syncing for constants that don't
  change on either side yet.
- **`updateApplicationContext` over `sendMessage`** for phone→watch pushes,
  since it's coalescing (only the latest snapshot matters, no need to queue
  every intermediate frame of a live workout) and delivers even if the watch
  app isn't foregrounded. Watch→phone actions use `sendMessage` when
  reachable, falling back to `transferUserInfo` otherwise.

# Stride Watch App

A real watchOS companion app: the watch does its own GPS tracking and
HealthKit workout session (better GPS accuracy on the wrist than the phone
in a pocket), computing pace on-device and streaming it to the phone over
WatchConnectivity. This replaced an earlier "phone mirrors its screens to
the watch" approach — that one is gone; this is the one actively developed
and debugged.

The Swift source lives in `watch/StrideWatchApp/` for version control, but
**Xcode target creation and wiring are manual steps** — Expo's config
plugins can't create a watchOS target for you. Do this once per machine:

## 1. Generate the native iOS project (if you haven't already)

```bash
cd mobile
npx expo prebuild --platform ios
```

This creates `ios/Stride.xcworkspace`. **Open the `.xcworkspace`, not the
`.xcodeproj`** (CocoaPods requires it).

Once you add the Watch App target below, `ios/` is no longer fully
described by `app.json` — **never run `expo prebuild --clean`** afterward,
it will delete your manually-added target. Just edit the Xcode project
directly from here on, like any bare React Native app.

## 2. Create the Watch App target

With `ios/Stride.xcworkspace` open in Xcode:

1. **File → New → Target…**
2. **watchOS** tab → **Watch App** template (the modern single-target
   template, not the old WatchKit App + Extension split).
3. In the sheet:
   - **Product Name:** `Stride Watch App`
   - **Language:** Swift, **Interface:** SwiftUI
   - **Minimum Deployment:** watchOS 10.0 (ground contact time / vertical
     oscillation / running power `HKQuantityType`s need watchOS 9+)
   - **Include Notification Scene:** unchecked
   - **Embed in Companion Application:** **Stride** — this makes Xcode
     derive the companion bundle ID automatically and wires up the
     WatchConnectivity pairing relationship.
4. **Finish**, and activate the new scheme when prompted.

## 3. Capabilities on the `Stride Watch App` target

Target → **Signing & Capabilities**:

- **+ Capability → HealthKit**
- **+ Capability → Background Modes** → check **Workout Processing** (this
  is what keeps the workout session / location updates alive when the
  watch screen sleeps — don't request "Always" location, "When In Use"
  plus an active `HKWorkoutSession` is the correct, sufficient pattern for
  a workout app).

## 4. Info.plist keys on the `Stride Watch App` target

Target → **Info** tab, add:

| Key | Example value |
|---|---|
| `NSLocationWhenInUseUsageDescription` | "Stride uses your location to track pace and route during a run." |
| `NSHealthShareUsageDescription` | "Stride reads your heart rate and running metrics during workouts." |
| `NSHealthUpdateUsageDescription` | "Stride saves your completed runs to Health." |

## 5. Add the Swift files

Drag the five files from `watch/StrideWatchApp/` in this repo into the
**Stride Watch App** group in Xcode (**Stride Watch App target checkbox
checked**, not the iOS app target):

- `RunPacket.swift` — the data packet sent to the phone
- `PaceCalculator.swift` — haversine distance + 15s rolling-window pace,
  same math as the phone's `mobile/src/usePaceTracker.ts`
- `WorkoutManager.swift` — `HKWorkoutSession` + `HKLiveWorkoutBuilder` +
  `HKWorkoutRouteBuilder`, `CLLocationManager`, live metric reads, and the
  WatchConnectivity send (`sendMessage` when reachable, falling back to
  `updateApplicationContext`)
- `ContentView.swift` — **replace** the template's auto-generated one, not
  a duplicate
- `StrideWatchApp.swift` — reference only; keep whatever Xcode's template
  actually generated (it'll have a product-name-derived struct name), just
  make sure it renders `ContentView()`

## 6. Bundle identifier note

`com.stride.app` was already registered to another Apple Developer team,
so this project uses `com.gracieudensi.stride` (set in `mobile/app.json`)
for the companion pairing to succeed. If you fork this for your own team,
you'll need your own unique identifier too.

## 7. Swift language mode

Apple's older delegate-based frameworks used here (`CLLocationManagerDelegate`,
`HKWorkoutSessionDelegate`, `HKLiveWorkoutBuilderDelegate`, `WCSessionDelegate`)
don't yet ship `Sendable`/`@MainActor` annotations, which conflicts with
Swift 6's strict concurrency checker. If you hit "reference to captured var
'self' in concurrently-executing code" or "does not conform to protocol"
errors, set the **Stride Watch App** target's Build Settings → **Swift
Language Mode** to **Swift 5**.

## Known limitation

This has only been built and run in this Xcode/watchOS environment
directly by you — it was never verified from an automated sandbox (no
macOS/Xcode/Swift toolchain available there). Treat build errors as
expected on the first pass in a new environment, and iterate.

# Stride Watch App

A real watchOS companion app: the watch does its own GPS tracking and
HealthKit workout session (better GPS accuracy on the wrist than the phone
in a pocket), computing pace on-device and streaming it to the phone over
WatchConnectivity. This replaced an earlier "phone mirrors its screens to
the watch" approach — that one is gone; this is the one actively developed
and debugged.

The Swift source is split into two pieces, both version-controlled here:

- `watch/StrideWatchCore/` — a local Swift Package holding the actual
  engine: `WorkoutManager` (HealthKit + CoreLocation + WatchConnectivity),
  `PaceCalculator`, and `RunPacket`. No SwiftUI dependency, so it's the
  testable, reusable core.
- `watch/StrideWatchApp/` — the thin UI layer (`ContentView.swift`,
  `WatchSplashView.swift`, `StrideWatchApp.swift`) that imports
  `StrideWatchCore` and just composes screens.

**Xcode target creation and wiring are still manual steps** — Expo's
config plugins can't create a watchOS target for you. Do this once per
machine:

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

## 5. Add the StrideWatchCore package

This is a local Swift Package (`watch/StrideWatchCore/Package.swift`), not
a loose file — add it as a package dependency, not by dragging `.swift`
files in:

1. With the project (not a specific file) selected in the navigator,
   **File → Add Package Dependencies…**
2. Click **Add Local…** at the bottom-left of the dialog, and select the
   `watch/StrideWatchCore` folder from this repo.
3. When prompted which target to add it to, choose **Stride Watch App**
   only (not the iPhone app target — it doesn't need this package).

If you missed the target picker, add it after the fact: select the
**Stride Watch App** target → **General** tab → **Frameworks, Libraries,
and Embedded Content** → **+** → pick **StrideWatchCore**.

## 6. Add the app-target Swift files

Drag these three files from `watch/StrideWatchApp/` in this repo into the
**Stride Watch App** group in Xcode (**Stride Watch App target checkbox
checked**, not the iOS app target, and not the package you just added —
these stay as loose files in the app target itself):

- `ContentView.swift` — **replace** the template's auto-generated one, not
  a duplicate; `import StrideWatchCore` at the top pulls in `WorkoutManager`
- `WatchSplashView.swift` — the launch splash (two footprints, same mark as
  the app icon and the phone/web splash screen); `ContentView` shows it for
  ~1.1s on launch, then fades it out
- `StrideWatchApp.swift` — reference only; keep whatever Xcode's template
  actually generated (it'll have a product-name-derived struct name), just
  make sure it renders `ContentView()`

## 7. Set the app icon

Xcode generates a placeholder `AppIcon` asset set for the Watch App target
that you need to replace — this can't be done by dropping in a Swift file,
it's an asset-catalog-only step:

1. In the **Stride Watch App** group, open **Assets.xcassets → AppIcon**.
2. Drag `watch/Assets/AppIcon-1024.png` from this repo into the single
   1024×1024 image well (modern watchOS targets use one universal size,
   same as iOS — Xcode scales it automatically).

It's the exact same footprints PNG used for the phone app's icon
(`mobile/assets/icon.png`), so the watch and phone icons match.

## 8. Bundle identifier note

`com.stride.app` was already registered to another Apple Developer team,
so this project uses `com.gracieudensi.stride` (set in `mobile/app.json`)
for the companion pairing to succeed. If you fork this for your own team,
you'll need your own unique identifier too.

## 9. Swift language mode

Apple's older delegate-based frameworks used by `WorkoutManager`
(`CLLocationManagerDelegate`, `HKWorkoutSessionDelegate`,
`HKLiveWorkoutBuilderDelegate`, `WCSessionDelegate`) don't yet ship
`Sendable`/`@MainActor` annotations, which conflicts with Swift 6's strict
concurrency checker. `StrideWatchCore/Package.swift` pins
`// swift-tools-version:5.9`, which keeps that package compiling under
Swift 5 language mode regardless of what the app target uses — so this
should no longer bite you now that `WorkoutManager` lives in the package
rather than as a loose file in the app target.

If you still hit "reference to captured var 'self' in concurrently-executing
code" or "does not conform to protocol" errors (e.g. if Xcode ever pulls
package settings differently than expected), the fallback is the same as
before: set the **Stride Watch App** target's Build Settings → **Swift
Language Mode** to **Swift 5**.

## 10. The phone-side receiver

Unlike the watch target, this half needs **no manual Xcode step** — it's a
regular autolinked Expo module at `mobile/modules/stride-watch-connectivity/`,
picked up automatically the next time you run `npx expo prebuild` /
`npx expo run:ios` (it's already declared as a dependency in
`mobile/package.json`, so `npm install` symlinks it and autolinking finds
its podspec).

It's a thin `WCSessionDelegate` (`WatchReceiver.swift`) that receives each
`RunPacket` the watch sends and forwards it to JS as an `onRunPacket` event.
On the JS side, `mobile/src/useWatchConnectivity.ts` subscribes to that and
exposes `{ paired, appInstalled, reachable, lastPacket, connected }` —
`App.js` uses it to prefer the watch's real HealthKit heart rate over the
phone's illustrative one, and to show ground contact time / vertical
oscillation / running power on the Live tab whenever the watch is actively
streaming. GPS distance/pace and run persistence stay owned by the phone
(`usePaceTracker`) — the watch only supplies the biometrics the phone can't
sense on its own.

## Known limitation

The watch target itself has only been built and run in this Xcode/watchOS
environment directly by you — it was never verified from an automated
sandbox (no macOS/Xcode/Swift toolchain available there). Treat build
errors as expected on the first pass in a new environment, and iterate.

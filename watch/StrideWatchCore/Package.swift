// swift-tools-version:5.9
// Pinning tools-version 5.9 (not 6.0) keeps this package compiling under
// Swift 5 language mode regardless of the app target's own setting — the
// same fix that was needed for WorkoutManager's Apple-framework delegate
// conformances (CLLocationManagerDelegate, HKWorkoutSessionDelegate, etc.)
// when they were loose files in the app target.
import PackageDescription

let package = Package(
    name: "StrideWatchCore",
    platforms: [.watchOS(.v10)],
    products: [
        .library(name: "StrideWatchCore", targets: ["StrideWatchCore"]),
    ],
    targets: [
        .target(name: "StrideWatchCore"),
    ]
)

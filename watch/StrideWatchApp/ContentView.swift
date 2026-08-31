import SwiftUI
import CoreLocation

// Same palette as the phone app's src/theme.js / mobile/src/theme.js.
enum StrideColor {
    static let bg = Color(red: 0x11 / 255, green: 0x12 / 255, blue: 0x14 / 255)
    static let cardBg = Color(red: 0x1B / 255, green: 0x1D / 255, blue: 0x20 / 255)
    static let ink = Color(red: 0xF5 / 255, green: 0xF5 / 255, blue: 0xF4 / 255)
    static let sub = Color(red: 0x9A / 255, green: 0x9D / 255, blue: 0xA3 / 255)
    static let accent1 = Color(red: 0x2E / 255, green: 0xD9 / 255, blue: 0x96 / 255) // green
    static let accent2 = Color(red: 0x29 / 255, green: 0xC4 / 255, blue: 0xDE / 255) // cyan
    static let red = Color(red: 0xE2 / 255, green: 0x58 / 255, blue: 0x4B / 255)
    static let amber = Color(red: 0xDB / 255, green: 0xA9 / 255, blue: 0x4A / 255)
}

struct ContentView: View {
    @StateObject private var workoutManager = WorkoutManager()

    var body: some View {
        ZStack {
            StrideColor.bg.ignoresSafeArea()

            if workoutManager.locationAuthorizationStatus == .denied || workoutManager.locationAuthorizationStatus == .restricted {
                permissionDeniedView
            } else if workoutManager.isRunning {
                activeRunView
            } else {
                readyView
            }
        }
    }

    // MARK: Ready (not started)

    private var readyView: some View {
        VStack(spacing: 10) {
            Text("READY")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(StrideColor.accent1)
                .tracking(1.2)

            Text("Start your run")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(StrideColor.ink)
                .multilineTextAlignment(.center)

            if let error = workoutManager.authorizationError {
                Text(error)
                    .font(.system(size: 10))
                    .foregroundColor(StrideColor.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 4)
            }

            Button(action: workoutManager.start) {
                Text("Start")
                    .font(.system(size: 15, weight: .bold))
                    .frame(maxWidth: .infinity)
            }
            .tint(StrideColor.accent1)
            .padding(.top, 4)
        }
        .padding()
    }

    // MARK: Location permission denied

    private var permissionDeniedView: some View {
        VStack(spacing: 8) {
            Text("LOCATION NEEDED")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(StrideColor.red)
                .tracking(1.0)
            Text("Enable location for Stride in Settings on this watch, or on your paired iPhone.")
                .font(.system(size: 11))
                .foregroundColor(StrideColor.sub)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    // MARK: Active run

    private var activeRunView: some View {
        ScrollView {
            VStack(spacing: 10) {
                statusBanner

                Text(elapsedString)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundColor(StrideColor.ink)
                    .monospacedDigit()

                VStack(spacing: 0) {
                    Text(paceString)
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundColor(StrideColor.accent1)
                    Text("pace / mi")
                        .font(.system(size: 9))
                        .foregroundColor(StrideColor.sub)
                }

                HStack(spacing: 8) {
                    metricTile("\(Int(workoutManager.heartRate))", "bpm", StrideColor.red)
                    metricTile(String(format: "%.0f", workoutManager.power), "watts", StrideColor.accent2)
                }
                HStack(spacing: 8) {
                    metricTile(String(format: "%.0f", workoutManager.groundContactTime), "GCT ms", StrideColor.ink)
                    metricTile(String(format: "%.1f", workoutManager.verticalOscillation), "VO cm", StrideColor.ink)
                }

                HStack(spacing: 8) {
                    Button(workoutManager.isPaused ? "Resume" : "Pause") {
                        workoutManager.isPaused ? workoutManager.resume() : workoutManager.pause()
                    }
                    .tint(StrideColor.amber)
                    Button("Stop") { workoutManager.stop() }
                        .tint(StrideColor.red)
                }
                .padding(.top, 2)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
        }
    }

    private var statusBanner: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(workoutManager.isPaused ? StrideColor.amber : StrideColor.accent1)
                .frame(width: 6, height: 6)
            Text(workoutManager.isPaused ? "Paused" : "Tracking")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(StrideColor.sub)
        }
    }

    private var elapsedString: String {
        let total = Int(workoutManager.elapsedSeconds)
        return String(format: "%02d:%02d", total / 60, total % 60)
    }

    private var paceString: String {
        guard workoutManager.currentPace > 0 else { return "—:—" }
        let total = Int(workoutManager.currentPace.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    private func metricTile(_ value: String, _ label: String, _ valueColor: Color) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(valueColor)
            Text(label)
                .font(.system(size: 8))
                .foregroundColor(StrideColor.sub)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(StrideColor.cardBg)
        .cornerRadius(10)
    }
}

#Preview {
    ContentView()
}

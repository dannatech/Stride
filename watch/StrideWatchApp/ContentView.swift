import SwiftUI
import CoreLocation
import StrideWatchCore

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

private enum RunState {
    case ready
    case running
    case paused
    case finished

    var title: String {
        switch self {
        case .ready: "STRIDE"
        case .running: "RUNNING"
        case .paused: "PAUSED"
        case .finished: "RUN COMPLETE"
        }
    }

    var color: Color {
        switch self {
        case .ready: StrideColor.sub
        case .running: StrideColor.accent1
        case .paused: StrideColor.amber
        case .finished: StrideColor.accent2
        }
    }
}

struct ContentView: View {
    @StateObject private var workoutManager = WorkoutManager()
    // WorkoutManager.stop() resets isRunning/isPaused immediately, but the
    // "run complete" screen is a UI-only beat before the user taps Done — it
    // doesn't need to live in WorkoutManager itself.
    @State private var justFinished = false
    @State private var showSplash = true

    private var runState: RunState {
        if justFinished { return .finished }
        return workoutManager.isRunning ? (workoutManager.isPaused ? .paused : .running) : .ready
    }

    var body: some View {
        ZStack {
            StrideColor.bg.ignoresSafeArea()

            if workoutManager.locationAuthorizationStatus == .denied || workoutManager.locationAuthorizationStatus == .restricted {
                permissionDeniedView
            } else {
                ScrollView {
                    VStack(spacing: 10) {
                        Text(runState.title)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(runState.color)
                            .tracking(1.2)

                        Text(elapsedString)
                            .font(.system(size: 34, weight: .semibold, design: .rounded))
                            .foregroundStyle(StrideColor.ink)
                            .monospacedDigit()

                        if runState == .running || runState == .paused || runState == .finished {
                            metricsGrid
                        }

                        if let error = workoutManager.authorizationError, runState == .ready {
                            Text(error)
                                .font(.system(size: 10))
                                .foregroundStyle(StrideColor.red)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 4)
                        }

                        controls
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                }
            }

            if showSplash {
                WatchSplashView()
                    .transition(.opacity)
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
                withAnimation(.easeOut(duration: 0.3)) { showSplash = false }
            }
        }
    }

    @ViewBuilder
    private var controls: some View {
        switch runState {
        case .ready:
            Button(action: workoutManager.start) {
                Label("Start Run", systemImage: "figure.run")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(StrideColor.accent1)

        case .running:
            HStack {
                Button(action: workoutManager.pause) {
                    Image(systemName: "pause.fill")
                }
                .tint(StrideColor.amber)

                Button(action: finishRun) {
                    Image(systemName: "stop.fill")
                }
                .tint(StrideColor.red)
            }

        case .paused:
            HStack {
                Button(action: workoutManager.resume) {
                    Image(systemName: "play.fill")
                }
                .tint(StrideColor.accent1)

                Button(action: finishRun) {
                    Image(systemName: "stop.fill")
                }
                .tint(StrideColor.red)
            }

        case .finished:
            Button("Done", action: resetRun)
                .buttonStyle(.borderedProminent)
                .tint(StrideColor.accent2)
        }
    }

    private var metricsGrid: some View {
        VStack(spacing: 8) {
            HStack(spacing: 18) {
                metric(value: String(format: "%.2f", workoutManager.distanceMiles), label: "MI")
                metric(value: paceString, label: "PACE")
            }
            HStack(spacing: 18) {
                metric(value: "\(Int(workoutManager.heartRate))", label: "BPM", valueColor: StrideColor.red)
                metric(value: String(format: "%.0f", workoutManager.power), label: "WATTS", valueColor: StrideColor.accent2)
            }
            HStack(spacing: 18) {
                metric(value: String(format: "%.0f", workoutManager.groundContactTime), label: "GCT MS", valueColor: StrideColor.accent2)
                metric(value: String(format: "%.1f", workoutManager.verticalOscillation), label: "VO CM", valueColor: StrideColor.accent2)
            }
        }
    }

    private var permissionDeniedView: some View {
        VStack(spacing: 8) {
            Text("LOCATION NEEDED")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(StrideColor.red)
                .tracking(1.0)
            Text("Enable location for Stride in Settings on this watch, or on your paired iPhone.")
                .font(.system(size: 11))
                .foregroundStyle(StrideColor.sub)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    private func metric(value: String, label: String, valueColor: Color = StrideColor.ink) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.headline)
                .foregroundStyle(valueColor)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(StrideColor.sub)
        }
        .frame(maxWidth: .infinity)
    }

    private var elapsedString: String {
        let totalSeconds = max(0, Int(workoutManager.elapsedSeconds))
        let hours = totalSeconds / 3_600
        let minutes = (totalSeconds % 3_600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        }
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private var paceString: String {
        guard workoutManager.currentPace > 0 else { return "—:—" }
        let totalSeconds = Int(workoutManager.currentPace.rounded())
        return String(format: "%d:%02d", totalSeconds / 60, totalSeconds % 60)
    }

    private func finishRun() {
        workoutManager.stop()
        justFinished = true
    }

    private func resetRun() {
        justFinished = false
        // stop() intentionally leaves elapsedSeconds at its final value so the
        // "run complete" screen can show it — clear it now that we're heading
        // back to the ready screen, or it'd sit there stale until next tick.
        workoutManager.elapsedSeconds = 0
    }
}

#Preview {
    ContentView()
}

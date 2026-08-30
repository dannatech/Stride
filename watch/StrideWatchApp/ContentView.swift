import SwiftUI

struct ContentView: View {
    @StateObject private var workoutManager = WorkoutManager()

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = workoutManager.authorizationError {
                    Text(error)
                        .font(.caption2)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }

                Text(elapsedString)
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .monospacedDigit()

                Text(paceString)
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .foregroundColor(.green)
                Text("pace /mi")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                HStack {
                    metric("\(Int(workoutManager.heartRate))", "bpm")
                    metric(String(format: "%.0f", workoutManager.groundContactTime), "GCT ms")
                }
                HStack {
                    metric(String(format: "%.1f", workoutManager.verticalOscillation), "VO cm")
                    metric(String(format: "%.0f", workoutManager.power), "W")
                }

                if workoutManager.isRunning {
                    HStack {
                        Button(workoutManager.isPaused ? "Resume" : "Pause") {
                            workoutManager.isPaused ? workoutManager.resume() : workoutManager.pause()
                        }
                        .tint(.orange)
                        Button("Stop") { workoutManager.stop() }
                            .tint(.red)
                    }
                } else {
                    Button("Start Run") { workoutManager.start() }
                        .tint(.green)
                }
            }
            .padding()
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

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 0) {
            Text(value).font(.system(.body, design: .rounded)).bold()
            Text(label).font(.system(size: 9)).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    ContentView()
}

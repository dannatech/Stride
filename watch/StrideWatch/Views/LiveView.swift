import SwiftUI

struct LiveView: View {
    @EnvironmentObject var conn: ConnectivityManager

    private var cue: String {
        let cues = conn.ai.liveCues
        guard !cues.isEmpty else { return "" }
        return cues[(conn.session.elapsed / 8) % cues.count]
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                HStack(spacing: 6) {
                    Circle().fill(conn.isReachable ? T.accent1 : T.sub).frame(width: 6, height: 6)
                    Text(conn.isReachable ? "iPhone Connected" : "iPhone Not Reachable")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(T.sub)
                }

                if !cue.isEmpty {
                    Text("\"\(cue)\"")
                        .font(.system(size: 11, weight: .medium))
                        .italic()
                        .foregroundColor(T.ink)
                        .multilineTextAlignment(.center)
                        .cardStyle(padding: 8)
                }

                VStack(spacing: 2) {
                    EyebrowText(text: "Elapsed")
                    Text(fmtClock(conn.session.elapsed))
                        .font(.system(size: 34, weight: .heavy))
                        .foregroundColor(T.ink)
                        .monospacedDigit()
                    HStack(alignment: .lastTextBaseline, spacing: 3) {
                        Text(fmtPace(conn.session.pace))
                            .font(.system(size: 22, weight: .heavy))
                            .foregroundColor(T.accent1)
                        Text("/mi")
                            .font(.system(size: 11))
                            .foregroundColor(T.sub)
                    }
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    StatTile(value: "\(String(format: "%.2f", conn.session.elapsed.doubleValueMiles)) mi", label: "Distance")
                    StatTile(value: "\(String(format: "%.1f", conn.session.speed)) mph", label: "Speed")
                    StatTile(value: "\(Int(conn.session.cadence)) spm", label: "Cadence")
                    StatTile(value: "\(Int(conn.session.hr)) bpm", label: "Heart Rate", valueColor: T.red)
                }

                VStack(spacing: 6) {
                    Text("Sprint \(conn.session.sprintIdx) of \(SampleData.sprintGoal)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(T.ink)
                    HStack(spacing: 4) {
                        ForEach(0..<SampleData.sprintGoal, id: \.self) { i in
                            Circle()
                                .fill(i < conn.session.sprintIdx ? T.accent1 : T.hair)
                                .frame(width: 6, height: 6)
                        }
                    }
                }

                Button {
                    conn.sendAction("lap")
                } label: {
                    Text("Lap")
                        .font(.system(size: 14, weight: .bold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(T.accent1)

                if !conn.session.laps.isEmpty {
                    VStack(spacing: 4) {
                        ForEach(Array(conn.session.laps.enumerated()), id: \.offset) { i, l in
                            HStack {
                                Text("Lap \(i + 1)").font(.system(size: 11, weight: .semibold)).foregroundColor(T.ink)
                                Spacer()
                                Text("\(fmtPace(l)) /mi").font(.system(size: 11)).foregroundColor(T.sub)
                            }
                        }
                    }
                    .cardStyle(padding: 8)
                }
            }
            .padding(.horizontal, 6)
        }
        .background(T.bg)
        .navigationTitle("Live")
    }
}

private extension Int {
    /// Rough distance approximation matching the phone app's live-session placeholder math.
    var doubleValueMiles: Double { Double(self) * 0.0028 + 0.4 }
}

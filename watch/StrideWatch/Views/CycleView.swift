import SwiftUI

struct CycleView: View {
    @EnvironmentObject var conn: ConnectivityManager
    @Environment(\.dismiss) private var dismiss
    @State private var expandedPhase: String?

    private var phase: String { phaseFor(conn.cycleDay) }
    private var periodIn: Int { conn.cycleLength - conn.cycleDay + 1 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Day \(conn.cycleDay) of \(conn.cycleLength) · \(phase) phase")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(T.ink)

                HStack(spacing: 4) {
                    ForEach(SampleData.phaseInfo, id: \.name) { p in
                        let active = expandedPhase == p.name
                        Button {
                            expandedPhase = active ? nil : p.name
                        } label: {
                            Text(p.name)
                                .font(.system(size: 8, weight: .semibold))
                                .foregroundColor(active ? T.accent1 : (p.name == phase ? T.ink : T.sub))
                                .padding(.vertical, 6)
                                .frame(maxWidth: .infinity)
                                .background(active ? T.pillActiveBg : T.cardBg)
                                .cornerRadius(999)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if let expandedPhase, let info = SampleData.phaseInfo.first(where: { $0.name == expandedPhase }) {
                    VStack(alignment: .leading, spacing: 6) {
                        EyebrowText(text: "\(info.name) · \(info.range)")
                        Text(info.desc).font(.system(size: 11)).foregroundColor(T.ink)
                        Text(info.tip).font(.system(size: 11)).foregroundColor(T.sub)
                    }
                    .cardStyle(padding: 10)
                }

                VStack(alignment: .leading, spacing: 4) {
                    EyebrowText(text: "Next Period", color: T.red)
                    Text("In \(periodIn) days").font(.system(size: 18, weight: .heavy)).foregroundColor(T.ink)
                }
                .cardStyle(padding: 10)

                VStack(alignment: .leading, spacing: 6) {
                    EyebrowText(text: "Training Tip")
                    Text(conn.ai.cycleTip).font(.system(size: 11)).foregroundColor(T.ink)
                }
                .cardStyle(padding: 10)

                VStack(spacing: 6) {
                    Button("Log Period Start") {
                        conn.sendAction("logPeriod")
                    }
                    .buttonStyle(.bordered)
                    .font(.system(size: 12, weight: .semibold))

                    Button("+1 Day") {
                        conn.sendAction("advanceDay")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(T.accent1)
                    .font(.system(size: 12, weight: .semibold))
                }
            }
            .padding(.horizontal, 6)
        }
        .background(T.bg)
        .navigationTitle("Cycle")
    }
}

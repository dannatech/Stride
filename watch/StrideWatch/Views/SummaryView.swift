import SwiftUI

struct SummaryView: View {
    @EnvironmentObject var conn: ConnectivityManager

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Good morning")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(T.ink)

                HStack {
                    Spacer()
                    ProgressRingView(value: Double(conn.sprintsToday), goal: Double(SampleData.sprintGoal), unit: "sprints")
                    Spacer()
                }
                .cardStyle(padding: 14)

                NavigationLink {
                    RecoveryView()
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            EyebrowText(text: "Recovery")
                            Text("Readiness \(readinessLabel(conn.readiness))")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(T.ink)
                        }
                        Spacer()
                        Text("\(conn.readiness)")
                            .font(.system(size: 16, weight: .heavy))
                            .foregroundColor(readinessColor(conn.readiness))
                        ChevronIcon()
                    }
                    .cardStyle(padding: 10)
                }
                .buttonStyle(.plain)

                NavigationLink {
                    CycleView()
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            EyebrowText(text: "Cycle · Day \(conn.cycleDay)")
                            Text("\(phaseFor(conn.cycleDay)) phase")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(T.ink)
                        }
                        Spacer()
                        ChevronIcon()
                    }
                    .cardStyle(padding: 10)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("This Week's Plan")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(T.ink)
                        Spacer()
                    }
                    ForEach(conn.ai.weeklyPlan) { d in
                        HStack(spacing: 6) {
                            Text(d.day.uppercased())
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(T.sub)
                                .frame(width: 24, alignment: .leading)
                            Circle()
                                .fill(intensityColor(d.intensity))
                                .frame(width: 6, height: 6)
                            Text(d.focus)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(T.ink)
                                .lineLimit(1)
                        }
                    }
                }
                .cardStyle(padding: 10)
            }
            .padding(.horizontal, 6)
        }
        .background(T.bg)
        .navigationTitle("Stride")
    }

    private func intensityColor(_ i: Int) -> Color {
        switch i {
        case 0: return .clear
        case 1: return T.sub
        case 2: return T.accent2
        default: return T.accent1
        }
    }
}

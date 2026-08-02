import SwiftUI

struct RecoveryView: View {
    @EnvironmentObject var conn: ConnectivityManager
    @State private var sleepHours = 7.4
    @State private var restingHR = 54
    @State private var soreness = "Low"
    @State private var stretchDone = false

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                VStack(spacing: 4) {
                    Text("\(conn.readiness)")
                        .font(.system(size: 36, weight: .heavy))
                        .foregroundColor(readinessColor(conn.readiness))
                    Text("\(readinessLabel(conn.readiness)) readiness today")
                        .font(.system(size: 11))
                        .foregroundColor(T.sub)
                }
                .padding(.vertical, 6)

                HStack(spacing: 8) {
                    StatTile(value: "\(String(format: "%.1f", sleepHours)) hr", label: "Sleep")
                    StatTile(value: "\(restingHR) bpm", label: "Resting HR")
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Muscle Soreness").font(.system(size: 12, weight: .bold)).foregroundColor(T.ink)
                    HStack(spacing: 4) {
                        ForEach(["Low", "Moderate", "High"], id: \.self) { s in
                            let active = soreness == s
                            Button {
                                soreness = s
                                conn.sendAction("setSoreness", params: ["value": s])
                            } label: {
                                Text(s)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(active ? T.accent1 : T.sub)
                                    .padding(.vertical, 6)
                                    .frame(maxWidth: .infinity)
                                    .background(active ? T.pillActiveBg : Color.clear)
                                    .overlay(RoundedRectangle(cornerRadius: 999).stroke(active ? T.accent1 : T.hair, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .cardStyle(padding: 10)

                Button {
                    stretchDone.toggle()
                    conn.sendAction("toggleStretch", params: ["value": stretchDone])
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Stretching").font(.system(size: 12, weight: .bold)).foregroundColor(T.ink)
                            Text(stretchDone ? "Done" : "Not yet").font(.system(size: 10)).foregroundColor(T.sub)
                        }
                        Spacer()
                        Image(systemName: stretchDone ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(stretchDone ? T.accent1 : T.hair)
                    }
                    .cardStyle(padding: 10)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 6)
        }
        .background(T.bg)
        .navigationTitle("Recovery")
    }
}

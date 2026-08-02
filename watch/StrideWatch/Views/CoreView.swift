import SwiftUI

struct CoreView: View {
    @EnvironmentObject var conn: ConnectivityManager
    @State private var holdingId: String?
    @State private var holdElapsed = 0
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var completed: Int {
        SampleData.coreExercises.filter { ex in
            let v = ex.id == holdingId ? holdElapsed : (conn.coreToday[ex.id] ?? 0)
            return v >= ex.target
        }.count
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("Core").font(.system(size: 17, weight: .bold)).foregroundColor(T.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack {
                    Spacer()
                    ProgressRingView(value: Double(completed), goal: Double(SampleData.coreGoal), unit: "exercises")
                    Spacer()
                }
                .cardStyle(padding: 14)

                VStack(spacing: 8) {
                    ForEach(SampleData.coreExercises) { ex in
                        CoreExerciseRow(
                            ex: ex,
                            logged: conn.coreToday[ex.id] ?? 0,
                            isHolding: holdingId == ex.id,
                            holdElapsed: holdElapsed,
                            onLogReps: { id, delta in
                                let next = max(0, (conn.coreToday[id] ?? 0) + delta)
                                conn.coreToday[id] = next
                                conn.sendAction("logReps", params: ["id": id, "value": next])
                            },
                            onStartHold: { id in
                                holdingId = id
                                holdElapsed = 0
                                conn.sendAction("startHold", params: ["id": id])
                            },
                            onStopHold: { id in
                                let next = max(conn.coreToday[id] ?? 0, holdElapsed)
                                conn.coreToday[id] = next
                                holdingId = nil
                                conn.sendAction("stopHold", params: ["id": id, "value": next])
                            }
                        )
                    }
                }
            }
            .padding(.horizontal, 6)
        }
        .background(T.bg)
        .navigationTitle("Core")
        .onReceive(timer) { _ in
            if holdingId != nil { holdElapsed += 1 }
        }
    }
}

import SwiftUI

struct HistoryView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("History").font(.system(size: 17, weight: .bold)).foregroundColor(T.ink)
                    Text("Recent workouts").font(.system(size: 11)).foregroundColor(T.sub)
                }

                VStack(spacing: 8) {
                    ForEach(Array(SampleData.history.enumerated()), id: \.offset) { i, w in
                        let prev = i + 1 < SampleData.history.count ? SampleData.history[i + 1] : nil
                        let faster = prev.map { w.pace < $0.pace } ?? true
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(w.date).font(.system(size: 12, weight: .semibold)).foregroundColor(T.ink)
                                Text("\(w.sprints) sprints · \(w.distance)").font(.system(size: 10)).foregroundColor(T.sub)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("\(fmtPace(w.pace)) /mi").font(.system(size: 12, weight: .bold)).foregroundColor(T.ink)
                                Text(faster ? "↑ faster" : "↓ slower")
                                    .font(.system(size: 9, weight: .semibold))
                                    .foregroundColor(faster ? T.accent1 : T.sub)
                            }
                        }
                        if i < SampleData.history.count - 1 {
                            Divider().background(T.hair)
                        }
                    }
                }
                .cardStyle(padding: 10)
            }
            .padding(.horizontal, 6)
        }
        .background(T.bg)
        .navigationTitle("History")
    }
}

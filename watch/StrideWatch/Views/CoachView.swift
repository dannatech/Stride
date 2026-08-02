import SwiftUI

struct CoachView: View {
    @EnvironmentObject var conn: ConnectivityManager

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("AI Coach").font(.system(size: 17, weight: .bold)).foregroundColor(T.ink)
                    Text("Insights from your training").font(.system(size: 11)).foregroundColor(T.sub)
                }

                insightCard(title: "Post-Workout", color: T.sub, text: conn.ai.postWorkoutInsight)
                insightCard(title: "This Week", color: T.accent2, text: conn.ai.weeklyNarrative)
                insightCard(title: "Core Strength", color: T.amber, text: conn.ai.coreInsight)
                insightCard(title: "Aerobic Fitness", color: T.accent1, text: conn.ai.vo2maxNote)
            }
            .padding(.horizontal, 6)
        }
        .background(T.bg)
        .navigationTitle("Coach")
    }

    private func insightCard(title: String, color: Color, text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            EyebrowText(text: title, color: color)
            Text(text).font(.system(size: 12)).foregroundColor(T.ink).fixedSize(horizontal: false, vertical: true)
        }
        .cardStyle(padding: 10)
    }
}

import SwiftUI

struct PaceView: View {
    private var avg: Double { SampleData.paceMinutes.reduce(0, +) / Double(SampleData.paceMinutes.count) }
    private var currentVO2: Double { SampleData.vo2maxHistory.last ?? 0 }
    private var vo2Min: Double { SampleData.vo2maxHistory.min() ?? 0 }
    private var vo2Max: Double { SampleData.vo2maxHistory.max() ?? 1 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Average Pace").font(.system(size: 11)).foregroundColor(T.sub)
                    HStack(alignment: .lastTextBaseline, spacing: 3) {
                        Text(fmtPace(avg)).font(.system(size: 24, weight: .heavy)).foregroundColor(T.ink)
                        Text("/mi").font(.system(size: 11)).foregroundColor(T.sub)
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            EyebrowText(text: "VO2max Estimate", color: T.accent2)
                            HStack(alignment: .lastTextBaseline, spacing: 3) {
                                Text(String(format: "%.1f", currentVO2)).font(.system(size: 20, weight: .heavy)).foregroundColor(T.ink)
                                Text("ml/kg/min").font(.system(size: 9)).foregroundColor(T.sub)
                            }
                        }
                        Spacer()
                        Text(vo2maxCategoryLabel(currentVO2))
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(vo2maxCategoryColor(currentVO2))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(vo2maxCategoryColor(currentVO2).opacity(0.2))
                            .cornerRadius(999)
                    }
                    HStack(alignment: .bottom, spacing: 4) {
                        ForEach(Array(SampleData.vo2maxHistory.enumerated()), id: \.offset) { i, v in
                            VStack(spacing: 2) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(i == SampleData.vo2maxHistory.count - 1 ? T.accent2 : T.hair)
                                    .frame(height: CGFloat(20 + (v - vo2Min) / max(vo2Max - vo2Min, 1) * 40))
                                Text(SampleData.vo2maxLabels[i]).font(.system(size: 6)).foregroundColor(T.sub)
                            }
                        }
                    }
                    .frame(height: 70, alignment: .bottom)
                }
                .cardStyle(padding: 10)

                VStack(spacing: 4) {
                    ForEach(Array(SampleData.paceMinutes.enumerated()), id: \.offset) { i, p in
                        HStack {
                            Text("Min \(i + 1)").font(.system(size: 11, weight: .semibold)).foregroundColor(T.sub)
                            Spacer()
                            Text("\(fmtPace(p)) /mi")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(SampleData.sprintMinutes.contains(i) ? T.accent2 : T.ink)
                        }
                    }
                }
                .cardStyle(padding: 10)
            }
            .padding(.horizontal, 6)
        }
        .background(T.bg)
        .navigationTitle("Pace")
    }
}

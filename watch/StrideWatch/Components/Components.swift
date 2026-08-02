import SwiftUI

struct EyebrowText: View {
    var text: String
    var color: Color = T.sub

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(color)
            .tracking(0.5)
    }
}

struct ChevronIcon: View {
    var body: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(T.sub)
    }
}

struct StatTile: View {
    var value: String
    var label: String
    var valueColor: Color = T.ink

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(valueColor)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(T.sub)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(padding: 8)
    }
}

/// Mirrors the ProgressRing in mobile/src/components.js — a circular
/// progress indicator with the value/goal centered inside it.
struct ProgressRingView: View {
    var value: Double
    var goal: Double
    var unit: String

    private var progress: Double { goal > 0 ? min(1, value / goal) : 0 }

    var body: some View {
        ZStack {
            Circle()
                .stroke(T.hair, lineWidth: 8)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(T.accent1, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(Int(value))")
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundColor(T.ink)
                Text("of \(Int(goal)) \(unit)")
                    .font(.system(size: 9))
                    .foregroundColor(T.sub)
            }
        }
        .frame(width: 84, height: 84)
    }
}

struct BackHeader: View {
    var title: String
    var onBack: () -> Void

    var body: some View {
        HStack {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .bold))
            }
            .buttonStyle(.plain)
            .foregroundColor(T.ink)
            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(T.ink)
            Spacer()
        }
    }
}

struct CoreExerciseRow: View {
    var ex: CoreExerciseDef
    var logged: Int
    var isHolding: Bool
    var holdElapsed: Int
    var onLogReps: (String, Int) -> Void
    var onStartHold: (String) -> Void
    var onStopHold: (String) -> Void

    private var current: Int { ex.type == "hold" ? (isHolding ? holdElapsed : logged) : logged }
    private var done: Bool { current >= ex.target }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(ex.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(T.ink)
                Text("\(current)/\(ex.target) \(ex.unit)")
                    .font(.system(size: 11))
                    .foregroundColor(done ? T.accent1 : T.sub)
            }
            Spacer()
            if ex.type == "hold" {
                Button(isHolding ? "Stop" : "Hold") {
                    isHolding ? onStopHold(ex.id) : onStartHold(ex.id)
                }
                .buttonStyle(.borderedProminent)
                .tint(isHolding ? T.red : T.accent1)
                .font(.system(size: 11, weight: .bold))
            } else {
                HStack(spacing: 6) {
                    Button("−") { onLogReps(ex.id, -5) }
                        .buttonStyle(.bordered)
                    Button("+") { onLogReps(ex.id, 5) }
                        .buttonStyle(.borderedProminent)
                        .tint(T.accent1)
                }
                .font(.system(size: 13, weight: .bold))
            }
        }
        .padding(10)
        .background(T.cardBg)
        .cornerRadius(12)
    }
}

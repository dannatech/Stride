import SwiftUI

/// Same footprint silhouette as the app icon and the phone/web splash screen
/// (see mobile/src/data.js FOOT_PATH, ported bezier-for-bezier). Natural
/// coordinate space: x 22...78, y 4...132 (a 56x128 bounding box), one
/// continuous path — wide toe pad, narrow instep waist, rounded heel.
struct FootprintShape: Shape {
    func path(in rect: CGRect) -> Path {
        let scaleX = rect.width / 56
        let scaleY = rect.height / 128
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: (x - 22) * scaleX, y: (y - 4) * scaleY)
        }

        var path = Path()
        path.move(to: pt(50, 4))
        path.addCurve(to: pt(78, 32), control1: pt(68, 4), control2: pt(78, 18))
        path.addCurve(to: pt(62, 62), control1: pt(78, 46), control2: pt(68, 54))
        path.addCurve(to: pt(62, 78), control1: pt(58, 67), control2: pt(58, 72))
        path.addCurve(to: pt(76, 108), control1: pt(70, 88), control2: pt(76, 96))
        path.addCurve(to: pt(50, 132), control1: pt(76, 122), control2: pt(64, 132))
        path.addCurve(to: pt(24, 108), control1: pt(36, 132), control2: pt(24, 122))
        path.addCurve(to: pt(38, 78), control1: pt(24, 96), control2: pt(30, 88))
        path.addCurve(to: pt(38, 62), control1: pt(42, 72), control2: pt(42, 67))
        path.addCurve(to: pt(22, 32), control1: pt(32, 54), control2: pt(22, 46))
        path.addCurve(to: pt(50, 4), control1: pt(22, 18), control2: pt(32, 4))
        path.closeSubpath()
        return path
    }
}

/// Shown briefly on launch, then fades into the app's normal content — see
/// ContentView's `showSplash` state.
struct WatchSplashView: View {
    var body: some View {
        ZStack {
            StrideColor.bg.ignoresSafeArea()
            VStack(spacing: 8) {
                ZStack {
                    FootprintShape()
                        .fill(StrideColor.accent1.opacity(0.55))
                        .frame(width: 26, height: 60)
                        .rotationEffect(.degrees(-9))
                        .offset(x: -5, y: 4)
                    FootprintShape()
                        .fill(StrideColor.accent1)
                        .frame(width: 26, height: 60)
                        .rotationEffect(.degrees(9))
                        .offset(x: 5, y: -4)
                }
                .frame(width: 60, height: 68)

                Text("Stride")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(StrideColor.ink)
            }
        }
    }
}

#Preview {
    WatchSplashView()
}

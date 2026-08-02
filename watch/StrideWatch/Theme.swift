import SwiftUI

/// Mirrors the color/spacing tokens in mobile/src/theme.js so the watch app
/// reads as the same product as the phone app.
enum T {
    static let bg = Color(hex: 0x111214)
    static let cardBg = Color(hex: 0x1B1D20)
    static let ink = Color(hex: 0xF5F5F4)
    static let sub = Color(hex: 0x9A9DA3)
    static let hair = Color(hex: 0x2A2C30)
    static let accent1 = Color(hex: 0x2ED996) // spring green
    static let accent2 = Color(hex: 0x29C4DE) // cyan/teal
    static let red = Color(hex: 0xE2584B)     // coral red
    static let amber = Color(hex: 0xDBA94A)   // gold
    static let radius: CGFloat = 16
    static let pillActiveBg = Color(hex: 0x2ED996).opacity(0.15)
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

/// Card container matching the `card()` helper in mobile/src/theme.js.
struct CardBackground: ViewModifier {
    var padding: CGFloat = 12

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(T.cardBg)
            .cornerRadius(T.radius)
    }
}

extension View {
    func cardStyle(padding: CGFloat = 12) -> some View {
        modifier(CardBackground(padding: padding))
    }
}

func readinessColor(_ score: Int) -> Color {
    score >= 80 ? T.accent1 : score >= 55 ? T.accent2 : T.red
}

func vo2maxCategoryColor(_ v: Double) -> Color {
    if v >= 52 { return T.accent1 }
    if v >= 47 { return T.accent1 }
    if v >= 42 { return T.accent2 }
    if v >= 35 { return T.amber }
    return T.red
}

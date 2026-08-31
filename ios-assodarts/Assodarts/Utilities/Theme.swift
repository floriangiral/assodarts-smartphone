import SwiftUI

/// Central design system for Assodarts — bright modern SaaS built on the club's
/// navy / orange logo identity.
enum Theme {
    static let canvas = Color(hex: 0xF6F7F4)
    static let surface = Color.white
    static let border = Color(hex: 0xE6E9E4)
    static let ink = Color(hex: 0x17233A)
    static let inkSecondary = Color(hex: 0x66716A)
    static let navy = Color(hex: 0x1C3660)
    static let navyDeep = Color(hex: 0x132743)
    static let navyTint = Color(hex: 0xE8EDF5)
    static let orange = Color(hex: 0xF5990B)
    static let orangeTint = Color(hex: 0xFDF0DF)

    static let green = Color(hex: 0x0E8A6D)
    static let greenTint = Color(hex: 0xE3F2ED)
    static let amber = Color(hex: 0xB45309)
    static let amberTint = Color(hex: 0xFDF0DF)
    static let red = Color(hex: 0xC0362C)
    static let redTint = Color(hex: 0xFBE9E7)

    static let cardRadius: CGFloat = 16
}

extension Color {
    /// Creates a color from a 24-bit RGB hex literal such as `0x1C3660`.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

private struct CardModifier: ViewModifier {
    let padding: CGFloat

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: Theme.cardRadius))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.cardRadius)
                    .stroke(Theme.border, lineWidth: 1)
            }
            .shadow(color: Theme.ink.opacity(0.05), radius: 12, x: 0, y: 4)
    }
}

extension View {
    /// Wraps content in the app's standard elevated white card.
    func assoCard(padding: CGFloat = 16) -> some View {
        modifier(CardModifier(padding: padding))
    }

    /// Applies the app canvas background, ignoring safe areas.
    func assoCanvas() -> some View {
        background(Theme.canvas.ignoresSafeArea())
    }
}

/// Small uppercase caption used above grouped content.
struct SectionLabel: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.6)
            .foregroundStyle(Theme.inkSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

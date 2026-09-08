import SwiftUI

/// Reusable tinted action treatment for compact full-width actions.
struct ActionButtonLabel: View {
    let title: String
    let symbol: String?
    let foreground: Color
    let background: Color
    var font: Font = .footnote.weight(.semibold)
    var height: CGFloat = 44
    var radius: CGFloat = Theme.controlRadius

    var body: some View {
        HStack(spacing: 8) {
            if let symbol {
                Image(systemName: symbol)
            }
            Text(title)
        }
        .font(font)
        .foregroundStyle(foreground)
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .background(background, in: .rect(cornerRadius: radius))
    }
}

struct TintedActionButton: View {
    let title: String
    var symbol: String?
    let foreground: Color
    let background: Color
    var font: Font = .footnote.weight(.semibold)
    var height: CGFloat = 44
    var radius: CGFloat = Theme.controlRadius
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ActionButtonLabel(
                title: title,
                symbol: symbol,
                foreground: foreground,
                background: background,
                font: font,
                height: height,
                radius: radius
            )
        }
        .buttonStyle(PressableButtonStyle())
    }
}

struct SelectionIndicator: View {
    let isSelected: Bool
    var isEnabled = true

    var body: some View {
        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
            .foregroundStyle(
                isSelected
                    ? Theme.navy
                    : Theme.inkSecondary.opacity(isEnabled ? 0.4 : 0.35)
            )
            .opacity(isEnabled ? 1 : 0.3)
    }
}

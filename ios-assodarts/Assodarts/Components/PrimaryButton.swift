import SwiftUI

/// Full-width navy call to action used across the app.
struct PrimaryButton: View {
    let title: String
    var symbol: String?
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let symbol {
                    Image(systemName: symbol)
                        .font(.subheadline.weight(.semibold))
                }
                Text(title)
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .foregroundStyle(.white)
            .background(isEnabled ? Theme.navy : Theme.navy.opacity(0.35))
            .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!isEnabled)
    }
}

/// Bordered navy secondary action.
struct SecondaryButton: View {
    let title: String
    var symbol: String?
    var tint: Color = Theme.navyText
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let symbol {
                    Image(systemName: symbol)
                        .font(.subheadline.weight(.semibold))
                }
                Text(title)
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .foregroundStyle(tint)
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: 14))
            .overlay {
                RoundedRectangle(cornerRadius: 14)
                    .stroke(tint.opacity(0.35), lineWidth: 1.5)
            }
        }
        .buttonStyle(PressableButtonStyle())
    }
}

/// Subtle press feedback shared by the app's custom buttons.
struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

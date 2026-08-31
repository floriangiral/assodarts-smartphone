import SwiftUI

/// The Assodarts emblem: a navy tile carrying the orange dart-flight chevron.
struct BrandMark: View {
    var size: CGFloat = 64

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [Theme.navy, Theme.navyDeep],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(width: size, height: size)
            .overlay {
                ZStack {
                    FlightShape()
                        .fill(Theme.orange)
                        .frame(width: size * 0.46, height: size * 0.5)
                        .offset(y: -size * 0.02)
                    FlightShape()
                        .fill(Color.white.opacity(0.9))
                        .frame(width: size * 0.2, height: size * 0.5)
                        .offset(y: -size * 0.02)
                }
            }
            .accessibilityHidden(true)
    }
}

/// Stylised dart flight used by the brand mark.
private struct FlightShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY - rect.height * 0.25))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

#Preview {
    VStack(spacing: 24) {
        BrandMark(size: 96)
        BrandMark(size: 44)
    }
    .padding()
    .assoCanvas()
}

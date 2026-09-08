import SwiftUI

/// Shared hierarchy for prominent monetary and dashboard figures.
struct MetricNumber: View {
    enum Size {
        case compact
        case prominent

        var pointSize: CGFloat {
            switch self {
            case .compact: 38
            case .prominent: 44
            }
        }
    }

    let value: String
    var size: Size = .compact
    var color: Color = Theme.ink

    var body: some View {
        Text(value)
            .font(.system(size: size.pointSize, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(color)
    }
}
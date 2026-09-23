import SwiftUI

/// Tinted semantic chip used for payment and membership states.
struct StatusChip: View {
    let text: String
    let tint: Color
    let background: Color
    var symbol: String?

    init(text: String, tint: Color, background: Color, symbol: String? = nil) {
        self.text = text
        self.tint = tint
        self.background = background
        self.symbol = symbol
    }

    init(state: PaymentState) {
        self.init(text: state.label, tint: state.tint, background: state.background)
    }

    var body: some View {
        HStack(spacing: 4) {
            if let symbol {
                Image(systemName: symbol)
                    .font(.caption2.weight(.bold))
            }
            Text(text)
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(background, in: .capsule)
    }
}

typealias ChipStyle = (text: String, tint: Color, background: Color)

func membershipFeeChip(hasRequestedFee: Bool, state: PaymentState) -> ChipStyle {
    guard hasRequestedFee else {
        return (tr("fee_not_requested"), Theme.inkSecondary, Theme.canvas)
    }

    switch state {
    case .paid:
        return (tr("fee_up_to_date"), state.tint, state.background)
    case .awaitingValidation:
        return (tr("fee_to_confirm"), state.tint, state.background)
    case .pending:
        return (tr("fee_to_pay"), state.tint, state.background)
    case .late:
        return (tr("fee_overdue"), state.tint, state.background)
    }
}

/// Coloured badge showing the role of a member.
struct RoleBadge: View {
    let role: Role

    var body: some View {
        Text(role.label)
            .font(.caption.weight(.semibold))
            .foregroundStyle(role.badgeForeground)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(role.badgeBackground, in: .capsule)
    }
}

#Preview {
    VStack(spacing: 12) {
        StatusChip(state: .paid)
        StatusChip(state: .awaitingValidation)
        StatusChip(state: .pending)
        StatusChip(state: .late)
        RoleBadge(role: .bureau)
        RoleBadge(role: .admin)
    }
    .padding()
    .assoCanvas()
}

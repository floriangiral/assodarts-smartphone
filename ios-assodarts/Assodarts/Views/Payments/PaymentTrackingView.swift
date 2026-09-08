import SwiftUI

/// Bureau-side collection tracking for one payment call, with reminders.
struct PaymentTrackingView: View {
    let callId: UUID

    @Environment(AppStore.self) private var store
    @State private var filter: Filter = .all
    @State private var remindedAll: Bool = false

    private enum Filter: String, CaseIterable, Identifiable {
        case all
        case toValidate
        case pending
        case paid

        var id: String { rawValue }

        var label: String {
            switch self {
            case .all: tr("all")
            case .toValidate: tr("to_confirm")
            case .pending: tr("pending")
            case .paid: tr("paid_paymenttrackingview")
            }
        }
    }

    private var call: PaymentCall? { store.paymentCall(callId) }

    private func items(_ call: PaymentCall) -> [PaymentItem] {
        let sorted = call.items.sorted { lhs, rhs in
            store.memberName(lhs.memberId).localizedCaseInsensitiveCompare(store.memberName(rhs.memberId))
                == .orderedAscending
        }
        switch filter {
        case .all: return sorted
        case .toValidate: return sorted.filter(\.isAwaitingValidation)
        case .pending: return sorted.filter { !$0.isPaid && $0.declaredAt == nil }
        case .paid: return sorted.filter(\.isPaid)
        }
    }

    var body: some View {
        ScrollView {
            if let call {
                VStack(spacing: 16) {
                    header(call)
                    progressCard(call)

                    Picker(tr("filter"), selection: $filter) {
                        ForEach(Filter.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)

                    VStack(spacing: 0) {
                        ForEach(items(call)) { item in
                            row(item, call: call)
                            if item.id != items(call).last?.id {
                                Divider().overlay(Theme.border).padding(.leading, 52)
                            }
                        }
                    }
                    .assoCard(padding: 14)

                    if call.awaitingCount > 0 {
                        NavigationLink(value: ClubRoute.paymentValidation) {
                            HStack(spacing: 10) {
                                Image(systemName: "clock.badge.checkmark")
                                    .foregroundStyle(Theme.navy)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(Fmt.count(call.awaitingCount, key: .paymentsToConfirm))
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(Theme.navy)
                                    Text(tr("declared_by_transfer_or_cash \(Fmt.money(call.awaitingCents))"))
                                        .font(.caption)
                                        .monospacedDigit()
                                        .foregroundStyle(Theme.inkSecondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.navy.opacity(0.6))
                            }
                            .padding(14)
                            .background(Theme.navyTint, in: .rect(cornerRadius: Theme.cardRadius))
                        }
                        .buttonStyle(.plain)
                    }

                    if call.chasableCount > 0 {
                        SecondaryButton(
                            title: remindedAll
                                ? tr("reminders_sent")
                                : tr("chase_the_unpaid \(call.chasableCount)"),
                            symbol: remindedAll ? "checkmark" : "bell.badge"
                        ) {
                            let unpaidIds = call.items
                                .filter { !$0.isPaid && $0.declaredAt == nil }
                                .map(\.memberId)
                            store.remind(callId: call.id, memberIds: unpaidIds)
                            NotificationService.notify(
                                title: tr("reminder_sent"),
                                body: tr("members_reminded_about \(unpaidIds.count) \(call.label)")
                            )
                            withAnimation { remindedAll = true }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }
        }
        .assoCanvas()
        .navigationTitle(tr("payment_tracking"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func header(_ call: PaymentCall) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(call.label)
                .font(.title3.bold())
                .foregroundStyle(Theme.ink)
            Text(tr("due_mypaymentsview \(Fmt.money(call.amountCents)) \(Fmt.shortDate(call.dueDate))"))
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func progressCard(_ call: PaymentCall) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(tr("collected_of \(Fmt.money(call.collectedCents)) \(Fmt.money(call.expectedCents))"))
                .font(.title3.bold())
                .monospacedDigit()
                .foregroundStyle(Theme.ink)

            ProgressView(value: call.progress)
                .tint(Theme.navy)

            HStack(spacing: 14) {
                counter(tr("paid_paymentcallsview \(call.paidCount)"), tint: Theme.green)
                if call.awaitingCount > 0 {
                    counter(
                        tr("to_confirm_paymenttrackingview \(call.awaitingCount)"),
                        tint: Theme.navy
                    )
                }
                counter(tr("pending_paymentcallsview \(call.pendingCount)"), tint: Theme.amber)
                counter(tr("overdue_paymentcallsview \(call.lateCount)"), tint: Theme.red)
            }
        }
        .assoCard(padding: 20)
    }

    private func counter(_ text: String, tint: Color) -> some View {
        HStack(spacing: 5) {
            Circle().fill(tint).frame(width: 7, height: 7)
            Text(text)
                .font(.caption.weight(.medium))
                .foregroundStyle(Theme.inkSecondary)
        }
    }

    private func row(_ item: PaymentItem, call: PaymentCall) -> some View {
        let state = item.state(dueDate: call.dueDate)
        let member = store.member(item.memberId)

        return HStack(spacing: 12) {
            AvatarView(initials: member?.initials ?? "??", photoData: member?.photoData, size: 38)

            VStack(alignment: .leading, spacing: 2) {
                Text(member?.fullName ?? tr("member"))
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.ink)
                Text(subtitle(item: item, call: call))
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary)
            }

            Spacer(minLength: 4)

            VStack(alignment: .trailing, spacing: 6) {
                StatusChip(state: state)
                if item.isAwaitingValidation {
                    Button(tr("confirm")) {
                        guard let validator = store.currentUser else { return }
                        withAnimation {
                            store.validatePayment(
                                callId: call.id,
                                memberId: item.memberId,
                                by: validator.id
                            )
                        }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.green)
                } else if !item.isPaid {
                    Button(tr("remind")) {
                        store.remind(callId: call.id, memberIds: [item.memberId])
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.navy)
                }
            }
        }
        .padding(.vertical, 9)
        .contextMenu {
            if item.isAwaitingValidation {
                Button(tr("confirm_payment"), systemImage: "checkmark.seal") {
                    guard let validator = store.currentUser else { return }
                    store.validatePayment(callId: call.id, memberId: item.memberId, by: validator.id)
                }
                Button(tr("reject_declaration"), systemImage: "xmark.circle", role: .destructive) {
                    store.cancelDeclaration(callId: call.id, memberId: item.memberId)
                }
            } else if !item.isPaid {
                Button(tr("mark_as_paid_cash"), systemImage: "banknote") {
                    store.markPaid(callId: call.id, memberId: item.memberId, method: .cash)
                }
            }
        }
    }

    private func subtitle(item: PaymentItem, call: PaymentCall) -> String {
        if item.isPaid, let paidAt = item.paidAt {
            let method = item.method.map { " · \($0.label)" } ?? ""
            return tr("paid_on_paymenttrackingview \(Fmt.money(call.amountCents)) \(Fmt.shortDate(paidAt)) \(method)")
        }
        if let declaredAt = item.declaredAt {
            let method = (item.method ?? .transfer).label
            return tr("declared_on_paymenttrackingview \(Fmt.money(call.amountCents)) \(method) \(Fmt.shortDate(declaredAt))")
        }
        if let reminded = item.remindedAt {
            return tr("reminded_on \(Fmt.money(call.amountCents)) \(Fmt.shortDate(reminded))")
        }
        return Fmt.money(call.amountCents)
    }
}

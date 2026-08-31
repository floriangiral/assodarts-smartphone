import SwiftUI

/// Bureau-side collection tracking for one payment call, with reminders.
struct PaymentTrackingView: View {
    let callId: UUID

    @Environment(AppStore.self) private var store
    @State private var filter: Filter = .all
    @State private var remindedAll: Bool = false

    private enum Filter: String, CaseIterable, Identifiable {
        case all
        case pending
        case paid

        var id: String { rawValue }

        var label: String {
            switch self {
            case .all: tr("Tous", "All")
            case .pending: tr("En attente", "Pending")
            case .paid: tr("Payés", "Paid")
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
        case .pending: return sorted.filter { !$0.isPaid }
        case .paid: return sorted.filter(\.isPaid)
        }
    }

    var body: some View {
        ScrollView {
            if let call {
                VStack(spacing: 16) {
                    header(call)
                    progressCard(call)

                    Picker(tr("Filtre", "Filter"), selection: $filter) {
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

                    if call.unpaidCount > 0 {
                        SecondaryButton(
                            title: remindedAll
                                ? tr("Relances envoyées", "Reminders sent")
                                : tr(
                                    "Relancer les \(call.unpaidCount) impayés",
                                    "Chase the \(call.unpaidCount) unpaid"
                                ),
                            symbol: remindedAll ? "checkmark" : "bell.badge"
                        ) {
                            let unpaidIds = call.items.filter { !$0.isPaid }.map(\.memberId)
                            store.remind(callId: call.id, memberIds: unpaidIds)
                            NotificationService.notify(
                                title: tr("Relance envoyée", "Reminder sent"),
                                body: tr(
                                    "\(unpaidIds.count) membres relancés pour \(call.label).",
                                    "\(unpaidIds.count) members reminded about \(call.label)."
                                )
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
        .navigationTitle(tr("Suivi des paiements", "Payment tracking"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func header(_ call: PaymentCall) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(call.label)
                .font(.title3.bold())
                .foregroundStyle(Theme.ink)
            Text(tr(
                "\(Fmt.money(call.amountCents)) · échéance \(Fmt.shortDate(call.dueDate))",
                "\(Fmt.money(call.amountCents)) · due \(Fmt.shortDate(call.dueDate))"
            ))
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func progressCard(_ call: PaymentCall) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(tr(
                "\(Fmt.money(call.collectedCents)) encaissés sur \(Fmt.money(call.expectedCents))",
                "\(Fmt.money(call.collectedCents)) collected of \(Fmt.money(call.expectedCents))"
            ))
                .font(.title3.bold())
                .monospacedDigit()
                .foregroundStyle(Theme.ink)

            ProgressView(value: call.progress)
                .tint(Theme.navy)

            HStack(spacing: 16) {
                counter(tr("\(call.paidCount) payés", "\(call.paidCount) paid"), tint: Theme.green)
                counter(tr("\(call.pendingCount) en attente", "\(call.pendingCount) pending"), tint: Theme.amber)
                counter(tr("\(call.lateCount) en retard", "\(call.lateCount) overdue"), tint: Theme.red)
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
                Text(member?.fullName ?? tr("Membre", "Member"))
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
                if !item.isPaid {
                    Button(tr("Relancer", "Remind")) {
                        store.remind(callId: call.id, memberIds: [item.memberId])
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.navy)
                }
            }
        }
        .padding(.vertical, 9)
        .contextMenu {
            if !item.isPaid {
                Button(tr("Marquer comme payé", "Mark as paid"), systemImage: "checkmark.circle") {
                    store.markPaid(callId: call.id, memberId: item.memberId)
                }
            }
        }
    }

    private func subtitle(item: PaymentItem, call: PaymentCall) -> String {
        if item.isPaid, let paidAt = item.paidAt {
            return tr(
                "\(Fmt.money(call.amountCents)) · payé le \(Fmt.shortDate(paidAt))",
                "\(Fmt.money(call.amountCents)) · paid on \(Fmt.shortDate(paidAt))"
            )
        }
        if let reminded = item.remindedAt {
            return tr(
                "\(Fmt.money(call.amountCents)) · relancé le \(Fmt.shortDate(reminded))",
                "\(Fmt.money(call.amountCents)) · reminded on \(Fmt.shortDate(reminded))"
            )
        }
        return Fmt.money(call.amountCents)
    }
}

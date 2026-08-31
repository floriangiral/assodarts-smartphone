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
            case .all: "Tous"
            case .pending: "En attente"
            case .paid: "Payés"
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

                    Picker("Filtre", selection: $filter) {
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
                                ? "Relances envoyées"
                                : "Relancer les \(call.unpaidCount) impayés",
                            symbol: remindedAll ? "checkmark" : "bell.badge"
                        ) {
                            let unpaidIds = call.items.filter { !$0.isPaid }.map(\.memberId)
                            store.remind(callId: call.id, memberIds: unpaidIds)
                            NotificationService.notify(
                                title: "Relance envoyée",
                                body: "\(unpaidIds.count) membres relancés pour \(call.label)."
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
        .navigationTitle("Suivi des paiements")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func header(_ call: PaymentCall) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(call.label)
                .font(.title3.bold())
                .foregroundStyle(Theme.ink)
            Text("\(Fmt.money(call.amountCents)) · échéance \(Fmt.shortDate(call.dueDate))")
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func progressCard(_ call: PaymentCall) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\(Fmt.money(call.collectedCents)) encaissés sur \(Fmt.money(call.expectedCents))")
                .font(.title3.bold())
                .monospacedDigit()
                .foregroundStyle(Theme.ink)

            ProgressView(value: call.progress)
                .tint(Theme.navy)

            HStack(spacing: 16) {
                counter("\(call.paidCount) payés", tint: Theme.green)
                counter("\(call.pendingCount) en attente", tint: Theme.amber)
                counter("\(call.lateCount) en retard", tint: Theme.red)
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
                Text(member?.fullName ?? "Membre")
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
                    Button("Relancer") {
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
                Button("Marquer comme payé", systemImage: "checkmark.circle") {
                    store.markPaid(callId: call.id, memberId: item.memberId)
                }
            }
            Button("Voir la fiche membre", systemImage: "person.crop.circle") {}
        }
    }

    private func subtitle(item: PaymentItem, call: PaymentCall) -> String {
        if item.isPaid, let paidAt = item.paidAt {
            return "\(Fmt.money(call.amountCents)) · payé le \(Fmt.shortDate(paidAt))"
        }
        if let reminded = item.remindedAt {
            return "\(Fmt.money(call.amountCents)) · relancé le \(Fmt.shortDate(reminded))"
        }
        return Fmt.money(call.amountCents)
    }
}

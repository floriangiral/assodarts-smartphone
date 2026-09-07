import SwiftUI

/// Member-side payments: what is due, and the receipt history.
struct MyPaymentsView: View {
    @Environment(AppStore.self) private var store
    @State private var payingCallId: UUID?

    private var payments: [(call: PaymentCall, item: PaymentItem)] {
        guard let user = store.currentUser else { return [] }
        return store.payments(for: user.id)
    }

    private var due: [(call: PaymentCall, item: PaymentItem)] {
        payments.filter { !$0.item.isPaid }.sorted { $0.call.dueDate < $1.call.dueDate }
    }

    private var history: [(call: PaymentCall, item: PaymentItem)] {
        payments.filter(\.item.isPaid).sorted {
            ($0.item.paidAt ?? .distantPast) > ($1.item.paidAt ?? .distantPast)
        }
    }

    private var dueCents: Int { due.reduce(0) { $0 + $1.call.amountCents } }

    private var awaitingCents: Int {
        due.filter(\.item.isAwaitingValidation).reduce(0) { $0 + $1.call.amountCents }
    }

    private var methods: [PaymentMethodKind] {
        store.currentBankAccount?.availableMethods ?? []
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                summaryCard

                if !due.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        SectionLabel(text: tr("due"))
                        VStack(spacing: 14) {
                            ForEach(due, id: \.item.id) { entry in
                                dueRow(entry)
                                if entry.item.id != due.last?.item.id {
                                    Divider().overlay(Theme.border)
                                }
                            }
                        }
                        .assoCard()
                    }
                }

                if !history.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        SectionLabel(text: tr("history"))
                        VStack(spacing: 0) {
                            ForEach(history, id: \.item.id) { entry in
                                historyRow(entry)
                                if entry.item.id != history.last?.item.id {
                                    Divider().overlay(Theme.border)
                                }
                            }
                        }
                        .assoCard(padding: 14)
                    }
                }

                methodsFooter
                    .padding(.top, 4)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .navigationTitle(tr("my_payments"))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: Binding(
            get: { payingCallId.map(PaymentSheetTarget.init(id:)) },
            set: { payingCallId = $0?.id }
        )) { target in
            PaySheet(callId: target.id)
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(tr("due"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary)

            MetricNumber(
                value: Fmt.money(dueCents),
                size: .prominent,
                color: dueCents > 0 ? Theme.orange : Theme.green
            )
                .contentTransition(.numericText())

            Text(dueCents > 0
                 ? Fmt.count(due.count, key: .pendingPayments)
                 : tr("all_your_payments_are_up_to_date"))
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)

            if awaitingCents > 0 {
                Label(
                    tr("including_awaiting_the_committee_s_confirmation \(Fmt.money(awaitingCents))"),
                    systemImage: "clock.badge.checkmark"
                )
                    .font(.caption.weight(.medium))
                    .monospacedDigit()
                    .foregroundStyle(Theme.navy)
                    .padding(.top, 2)
            }
        }
        .assoCard(padding: 20)
    }

    private var methodsFooter: some View {
        VStack(spacing: 6) {
            if methods.isEmpty {
                Label(
                    tr("the_committee_has_not_enabled_payments_yet"),
                    systemImage: "info.circle"
                )
            } else {
                Label(
                    methods.map(\.label).joined(separator: " · "),
                    systemImage: "lock.shield"
                )
            }
        }
        .font(.caption)
        .multilineTextAlignment(.center)
        .foregroundStyle(Theme.inkSecondary)
    }

    private func dueRow(_ entry: (call: PaymentCall, item: PaymentItem)) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.call.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Text(tr("due_mypaymentsview \(Fmt.money(entry.call.amountCents)) \(Fmt.shortDate(entry.call.dueDate))"))
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
                StatusChip(state: entry.item.state(dueDate: entry.call.dueDate))
            }

            if entry.item.isAwaitingValidation {
                awaitingBlock(entry)
            } else {
                Button {
                    payingCallId = entry.call.id
                } label: {
                    Text(tr("pay \(Fmt.money(entry.call.amountCents))"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(Theme.navy, in: .rect(cornerRadius: Theme.controlRadius))
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
    }

    /// A transfer or cash payment the member has declared: nothing left to do
    /// but wait for the bureau, with a way out if it was a mistake.
    private func awaitingBlock(_ entry: (call: PaymentCall, item: PaymentItem)) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: (entry.item.method ?? .transfer).symbol)
                    .font(.caption)
                    .foregroundStyle(Theme.navy)
                Text(tr("declared_on \((entry.item.method ?? .transfer).label) \(Fmt.shortDate(entry.item.declaredAt ?? .now))"))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.navy)
                Spacer(minLength: 0)
            }

            Text(tr("the_committee_will_confirm_as_soon_as_the_money_arrives"))
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)

            Button(tr("cancel_my_declaration")) {
                guard let user = store.currentUser else { return }
                withAnimation {
                    store.cancelDeclaration(callId: entry.call.id, memberId: user.id)
                }
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.red)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.navyTint.opacity(0.7), in: .rect(cornerRadius: Theme.controlRadius))
    }

    private func historyRow(_ entry: (call: PaymentCall, item: PaymentItem)) -> some View {
        HStack(spacing: 12) {
            Image(systemName: entry.call.category.symbol)
                .font(.footnote)
                .foregroundStyle(Theme.navy)
                .frame(width: 34, height: 34)
                .background(Theme.navyTint, in: .circle)

            VStack(alignment: .leading, spacing: 2) {
                Text(entry.call.label)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.ink)
                Text(tr("paid_on \(Fmt.money(entry.call.amountCents)) \(Fmt.shortDate(entry.item.paidAt ?? entry.call.dueDate))"))
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary)
            }

            Spacer(minLength: 4)

            StatusChip(state: .paid)
        }
        .padding(.vertical, 9)
    }
}

/// Wrapper making a payment call identifiable for `sheet(item:)`.
struct PaymentSheetTarget: Identifiable, Hashable {
    let id: UUID
}

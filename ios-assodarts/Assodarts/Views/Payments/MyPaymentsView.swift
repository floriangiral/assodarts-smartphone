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
                        SectionLabel(text: tr("À régler", "Due"))
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
                        SectionLabel(text: tr("Historique", "History"))
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
        .navigationTitle(tr("Mes paiements", "My payments"))
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
            Text(tr("À régler", "Due"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary)

            Text(Fmt.money(dueCents))
                .font(.system(size: 42, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(dueCents > 0 ? Theme.orange : Theme.green)
                .contentTransition(.numericText())

            Text(dueCents > 0
                 ? Fmt.count(due.count, "paiement en attente", "paiements en attente", "pending payment", "pending payments")
                 : tr("Vous êtes à jour de vos paiements", "All your payments are up to date"))
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)

            if awaitingCents > 0 {
                Label(
                    tr(
                        "dont \(Fmt.money(awaitingCents)) en attente de validation du bureau",
                        "including \(Fmt.money(awaitingCents)) awaiting the committee's confirmation"
                    ),
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
                    tr(
                        "Le bureau n'a pas encore activé les paiements",
                        "The committee has not enabled payments yet"
                    ),
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
                    Text(tr(
                        "\(Fmt.money(entry.call.amountCents)) · échéance \(Fmt.shortDate(entry.call.dueDate))",
                        "\(Fmt.money(entry.call.amountCents)) · due \(Fmt.shortDate(entry.call.dueDate))"
                    ))
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
                    Text(tr(
                        "Payer \(Fmt.money(entry.call.amountCents))",
                        "Pay \(Fmt.money(entry.call.amountCents))"
                    ))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(Theme.navy, in: .rect(cornerRadius: 12))
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
                Text(tr(
                    "\((entry.item.method ?? .transfer).label) déclaré le \(Fmt.shortDate(entry.item.declaredAt ?? .now))",
                    "\((entry.item.method ?? .transfer).label) declared on \(Fmt.shortDate(entry.item.declaredAt ?? .now))"
                ))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.navy)
                Spacer(minLength: 0)
            }

            Text(tr(
                "Le bureau validera dès réception des fonds.",
                "The committee will confirm as soon as the money arrives."
            ))
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)

            Button(tr("Annuler ma déclaration", "Cancel my declaration")) {
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
        .background(Theme.navyTint.opacity(0.7), in: .rect(cornerRadius: 12))
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
                Text(tr(
                    "\(Fmt.money(entry.call.amountCents)) · payé le \(Fmt.shortDate(entry.item.paidAt ?? entry.call.dueDate))",
                    "\(Fmt.money(entry.call.amountCents)) · paid on \(Fmt.shortDate(entry.item.paidAt ?? entry.call.dueDate))"
                ))
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

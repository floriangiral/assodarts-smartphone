import SwiftUI

/// Bureau list of every payment call with its collection progress.
struct PaymentCallsView: View {
    @Environment(AppStore.self) private var store
    @State private var showsComposer: Bool = false

    private var calls: [PaymentCall] {
        guard let club = store.currentClub else { return [] }
        return store.paymentCalls(of: club.id)
    }

    private var collectedCents: Int { calls.reduce(0) { $0 + $1.collectedCents } }
    private var expectedCents: Int { calls.reduce(0) { $0 + $1.expectedCents } }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(tr("Encaissé cette saison", "Collected this season"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.inkSecondary)
                    Text(tr(
                        "\(Fmt.money(collectedCents)) sur \(Fmt.money(expectedCents))",
                        "\(Fmt.money(collectedCents)) of \(Fmt.money(expectedCents))"
                    ))
                        .font(.title2.bold())
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                    ProgressView(value: expectedCents == 0 ? 0 : Double(collectedCents) / Double(expectedCents))
                        .tint(Theme.navy)
                }
                .assoCard(padding: 20)

                ForEach(calls) { call in
                    NavigationLink(value: ClubRoute.paymentCall(call.id)) {
                        PaymentCallCard(call: call)
                    }
                    .buttonStyle(.plain)
                }

                if calls.isEmpty {
                    ContentUnavailableView(
                        tr("Aucun appel à paiement", "No payment requests"),
                        systemImage: "eurosign.circle",
                        description: Text(tr(
                            "Créez un appel pour les cotisations, tenues ou déplacements.",
                            "Create a request for membership fees, kit or travel."
                        ))
                    )
                    .padding(.top, 50)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .navigationTitle(tr("Appels à paiement", "Payment requests"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showsComposer = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel(tr("Nouvel appel à paiement", "New payment request"))
            }
        }
        .sheet(isPresented: $showsComposer) {
            NewPaymentCallSheet()
        }
    }
}

/// Summary card of one payment call.
struct PaymentCallCard: View {
    let call: PaymentCall

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: call.category.symbol)
                    .font(.footnote)
                    .foregroundStyle(Theme.navy)
                    .frame(width: 34, height: 34)
                    .background(Theme.navyTint, in: .circle)

                VStack(alignment: .leading, spacing: 2) {
                    Text(call.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.leading)
                    Text(tr(
                        "\(Fmt.money(call.amountCents)) · échéance \(Fmt.shortDate(call.dueDate))",
                        "\(Fmt.money(call.amountCents)) · due \(Fmt.shortDate(call.dueDate))"
                    ))
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.inkSecondary)
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.6))
            }

            ProgressView(value: call.progress)
                .tint(call.lateCount > 0 ? Theme.orange : Theme.navy)

            HStack(spacing: 10) {
                Text(tr(
                    "\(Fmt.money(call.collectedCents)) encaissés",
                    "\(Fmt.money(call.collectedCents)) collected"
                ))
                    .font(.caption.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Spacer()
                Text(tr("\(call.paidCount) payés", "\(call.paidCount) paid"))
                    .font(.caption)
                    .foregroundStyle(Theme.green)
                if call.pendingCount > 0 {
                    Text(tr("\(call.pendingCount) en attente", "\(call.pendingCount) pending"))
                        .font(.caption)
                        .foregroundStyle(Theme.amber)
                }
                if call.lateCount > 0 {
                    Text(tr("\(call.lateCount) en retard", "\(call.lateCount) overdue"))
                        .font(.caption)
                        .foregroundStyle(Theme.red)
                }
            }
        }
        .assoCard()
    }
}

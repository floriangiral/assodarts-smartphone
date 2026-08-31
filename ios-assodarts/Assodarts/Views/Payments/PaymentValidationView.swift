import SwiftUI

/// Validation queue of the bureau: every transfer or cash payment declared by a
/// member, waiting for someone from the bureau to confirm the money arrived.
struct PaymentValidationView: View {
    @Environment(AppStore.self) private var store

    @State private var rejecting: RejectTarget?

    private struct RejectTarget: Identifiable {
        let callId: UUID
        let memberId: UUID
        let name: String
        var id: String { "\(callId)-\(memberId)" }
    }

    private var queue: [(call: PaymentCall, item: PaymentItem)] {
        guard let club = store.currentClub else { return [] }
        return store.pendingValidations(of: club.id)
    }

    private var totalCents: Int {
        queue.reduce(0) { $0 + $1.call.amountCents }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if queue.isEmpty {
                    ContentUnavailableView(
                        tr("Rien à valider", "Nothing to confirm"),
                        systemImage: "checkmark.seal",
                        description: Text(tr(
                            "Les virements et paiements en espèces déclarés par vos membres apparaîtront ici.",
                            "Transfers and cash payments declared by your members will appear here."
                        ))
                    )
                    .padding(.top, 60)
                } else {
                    summaryCard
                    ForEach(queue, id: \.item.id) { entry in
                        card(entry)
                    }
                    Text(tr(
                        "Validez uniquement après avoir vu les fonds sur le compte du club ou encaissé les espèces.",
                        "Only confirm once you have seen the money on the club account or received the cash."
                    ))
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Theme.inkSecondary)
                        .padding(.horizontal, 8)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .navigationTitle(tr("Paiements à valider", "Payments to confirm"))
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            rejecting.map {
                tr("Refuser le paiement de \($0.name) ?", "Reject \($0.name)'s payment?")
            } ?? "",
            isPresented: Binding(get: { rejecting != nil }, set: { if !$0 { rejecting = nil } }),
            titleVisibility: .visible
        ) {
            if let target = rejecting {
                Button(tr("Refuser et remettre en attente", "Reject and set back to pending"), role: .destructive) {
                    store.cancelDeclaration(callId: target.callId, memberId: target.memberId)
                    rejecting = nil
                }
            }
            Button(tr("Annuler", "Cancel"), role: .cancel) { rejecting = nil }
        } message: {
            Text(tr(
                "Le membre sera de nouveau invité à régler et pourra être relancé.",
                "The member will be asked to pay again and can be chased."
            ))
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(tr("En attente de validation", "Awaiting confirmation"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary)
            Text(Fmt.money(totalCents))
                .font(.system(size: 38, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Theme.navy)
                .contentTransition(.numericText())
            Text(Fmt.count(
                queue.count,
                "déclaration de membre",
                "déclarations de membres",
                "member declaration",
                "member declarations"
            ))
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
        }
        .assoCard(padding: 20)
    }

    private func card(_ entry: (call: PaymentCall, item: PaymentItem)) -> some View {
        let member = store.member(entry.item.memberId)
        let method = entry.item.method ?? .transfer

        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                AvatarView(initials: member?.initials ?? "??", photoData: member?.photoData, size: 42)

                VStack(alignment: .leading, spacing: 3) {
                    Text(member?.fullName ?? tr("Membre", "Member"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Text(entry.call.label)
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Text(Fmt.money(entry.call.amountCents))
                    .font(.headline)
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
            }

            HStack(spacing: 8) {
                StatusChip(
                    text: method.label,
                    tint: Theme.navy,
                    background: Theme.navyTint,
                    symbol: method.symbol
                )
                if let declaredAt = entry.item.declaredAt {
                    Text(tr(
                        "déclaré le \(Fmt.shortDate(declaredAt))",
                        "declared on \(Fmt.shortDate(declaredAt))"
                    ))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
            }

            if let reference = entry.item.reference {
                HStack(spacing: 6) {
                    Image(systemName: "text.quote")
                        .font(.caption2)
                    Text(reference)
                        .font(.caption.monospaced())
                }
                .foregroundStyle(Theme.inkSecondary)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.canvas, in: .rect(cornerRadius: 10))
            }

            HStack(spacing: 10) {
                Button {
                    validate(entry)
                } label: {
                    Label(tr("Valider", "Confirm"), systemImage: "checkmark")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Theme.green, in: .rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())

                Button {
                    rejecting = RejectTarget(
                        callId: entry.call.id,
                        memberId: entry.item.memberId,
                        name: member?.firstName ?? tr("ce membre", "this member")
                    )
                } label: {
                    Label(tr("Refuser", "Reject"), systemImage: "xmark")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.red)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Theme.redTint, in: .rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())
            }

            NavigationLink(value: ClubRoute.paymentCall(entry.call.id)) {
                HStack(spacing: 4) {
                    Text(tr("Voir l'appel à paiement", "Open the payment request"))
                        .font(.caption.weight(.semibold))
                    Image(systemName: "chevron.right")
                        .font(.caption2.weight(.bold))
                }
                .foregroundStyle(Theme.navy)
            }
            .buttonStyle(.plain)
        }
        .assoCard(padding: 18)
    }

    private func validate(_ entry: (call: PaymentCall, item: PaymentItem)) {
        guard let validator = store.currentUser else { return }
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            store.validatePayment(
                callId: entry.call.id,
                memberId: entry.item.memberId,
                by: validator.id
            )
        }
        NotificationService.notify(
            title: tr("Paiement validé", "Payment confirmed"),
            body: tr(
                "\(store.memberName(entry.item.memberId)) · \(Fmt.money(entry.call.amountCents)) encaissés.",
                "\(store.memberName(entry.item.memberId)) · \(Fmt.money(entry.call.amountCents)) collected."
            )
        )
    }
}

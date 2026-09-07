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
                    EmptyStateView(
                        tr("nothing_to_confirm"),
                        systemImage: "checkmark.seal",
                        description: Text(tr("transfers_and_cash_payments_declared_by_your_members_wil"))
                    )
                    .padding(.top, 60)
                } else {
                    summaryCard
                    ForEach(queue, id: \.item.id) { entry in
                        card(entry)
                    }
                    Text(tr("only_confirm_once_you_have_seen_the_money_on_the_club_ac"))
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
        .navigationTitle(tr("payments_to_confirm"))
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            rejecting.map {
                tr("reject_s_payment \($0.name)")
            } ?? "",
            isPresented: Binding(get: { rejecting != nil }, set: { if !$0 { rejecting = nil } }),
            titleVisibility: .visible
        ) {
            if let target = rejecting {
                Button(tr("reject_and_set_back_to_pending"), role: .destructive) {
                    store.cancelDeclaration(callId: target.callId, memberId: target.memberId)
                    rejecting = nil
                }
            }
            Button(tr("cancel"), role: .cancel) { rejecting = nil }
        } message: {
            Text(tr("the_member_will_be_asked_to_pay_again_and_can_be_chased"))
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(tr("awaiting_confirmation"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary)
            MetricNumber(value: Fmt.money(totalCents), color: Theme.navy)
                .contentTransition(.numericText())
            Text(Fmt.count(queue.count, key: .memberDeclarations))
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
                    Text(member?.fullName ?? tr("member"))
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
                    Text(tr("declared_on_paymentvalidationview \(Fmt.shortDate(declaredAt))"))
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
                .background(Theme.canvas, in: .rect(cornerRadius: Theme.compactRadius))
            }

            HStack(spacing: 10) {
                Button {
                    validate(entry)
                } label: {
                    Label(tr("confirm"), systemImage: "checkmark")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Theme.green, in: .rect(cornerRadius: Theme.controlRadius))
                }
                .buttonStyle(PressableButtonStyle())

                Button {
                    rejecting = RejectTarget(
                        callId: entry.call.id,
                        memberId: entry.item.memberId,
                        name: member?.firstName ?? tr("this_member")
                    )
                } label: {
                    Label(tr("reject"), systemImage: "xmark")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.red)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Theme.redTint, in: .rect(cornerRadius: Theme.controlRadius))
                }
                .buttonStyle(PressableButtonStyle())
            }

            NavigationLink(value: ClubRoute.paymentCall(entry.call.id)) {
                HStack(spacing: 4) {
                    Text(tr("open_the_payment_request"))
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
            title: tr("payment_confirmed_paymentvalidationview"),
            body: tr("collected_paymentvalidationview \(store.memberName(entry.item.memberId)) \(Fmt.money(entry.call.amountCents))")
        )
    }
}

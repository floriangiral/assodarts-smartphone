import SwiftUI

/// The club's own Assodarts subscription: current plan, coupon and pricing grid.
struct SubscriptionView: View {
    @Environment(AppStore.self) private var store

    @State private var stripeSheet: IdentifiableURL?
    @State private var isWorking: Bool = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            if let club = store.currentClub {
                VStack(spacing: 16) {
                    currentPlanCard(club)

                    if store.canManageClub {
                        actionCard(club)
                    }

                    if let coupon = store.coupon(for: club) {
                        couponCard(coupon, club: club)
                    }

                    pricingGrid(club)

                    VStack(alignment: .leading, spacing: 8) {
                        Label(tr("annual_billing"), systemImage: "info.circle")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text(tr("one_payment_a_year_with_a_lower_rate_per_member_as_the_c"))
                            .font(.footnote)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    .assoCard()
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }
        }
        .assoCanvas()
        .navigationTitle(tr("subscription"))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $stripeSheet, onDismiss: { Task { await store.refresh() } }) { sheet in
            SafariSheet(url: sheet.url)
        }
    }

    /// Subscribe, manage or reactivate, depending on where the club stands.
    private func actionCard(_ club: Club) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            switch club.status {
            case .trial:
                Text(tr("your_free_trial_ends_on \(Fmt.shortDate(club.renewalDate))"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                PrimaryButton(
                    title: isWorking ? tr("opening") : tr("subscribe_now"),
                    symbol: isWorking ? "ellipsis" : "creditcard.fill",
                    isEnabled: !isWorking,
                    action: { startCheckout(club) }
                )
            case .active:
                PrimaryButton(
                    title: isWorking ? tr("opening") : tr("manage_my_subscription"),
                    symbol: isWorking ? "ellipsis" : "gearshape.fill",
                    isEnabled: !isWorking,
                    action: { openPortal(club) }
                )
            case .grace:
                Label(tr("the_last_payment_failed_update_your_card_to_keep_the_clu"), systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.amber)
                PrimaryButton(
                    title: isWorking ? tr("opening") : tr("update_my_payment_method"),
                    symbol: isWorking ? "ellipsis" : "creditcard.fill",
                    isEnabled: !isWorking,
                    action: { openPortal(club) }
                )
            case .expired:
                Label(tr("the_subscription_has_expired_the_club_is_read_only_until"), systemImage: "lock.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.red)
                PrimaryButton(
                    title: isWorking ? tr("opening") : tr("reactivate_my_subscription"),
                    symbol: isWorking ? "ellipsis" : "arrow.clockwise",
                    isEnabled: !isWorking,
                    action: { startCheckout(club) }
                )
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .assoCard(padding: 20)
    }

    private func startCheckout(_ club: Club) {
        run { try await StripeService.startClubSubscriptionCheckout(clubId: club.id) }
    }

    private func openPortal(_ club: Club) {
        run { try await StripeService.openBillingPortal(clubId: club.id) }
    }

    private func run(_ operation: @escaping () async throws -> URL) {
        guard !isWorking else { return }
        isWorking = true
        errorMessage = nil
        Task {
            do {
                stripeSheet = IdentifiableURL(url: try await operation())
            } catch {
                errorMessage = friendlyMessage(for: error)
            }
            isWorking = false
        }
    }

    private func currentPlanCard(_ club: Club) -> some View {
        let tier = store.tier(for: club)
        let priceCents = store.annualPriceCents(for: club)

        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(tr("plan \(tier.name)"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.inkSecondary)
                Spacer()
                StatusChip(
                    text: club.status.label,
                    tint: club.status == .active ? Theme.green : Theme.amber,
                    background: club.status == .active ? Theme.greenTint : Theme.amberTint
                )
            }

            HStack(alignment: .firstTextBaseline, spacing: 10) {
                MetricNumber(
                    value: priceCents == 0 && tier.priceEuros > 0
                        ? tr("free")
                        : Fmt.money(priceCents)
                )
                Text(tr("year"))
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
            }

            if store.coupon(for: club) != nil, tier.priceEuros > 0 {
                Text(Fmt.euros(tier.priceEuros))
                    .font(.subheadline)
                    .strikethrough()
                    .foregroundStyle(Theme.inkSecondary)
            }

            Divider().overlay(Theme.border)

            HStack {
                Label(
                    Fmt.count(store.memberCount(of: club), key: .members),
                    systemImage: "person.3.fill"
                )
                Spacer()
                Label(
                    tr("renews_on \(Fmt.shortDate(club.renewalDate))"),
                    systemImage: "arrow.clockwise"
                )
            }
            .font(.caption)
            .foregroundStyle(Theme.inkSecondary)
        }
        .assoCard(padding: 20)
    }

    private func couponCard(_ coupon: Coupon, club: Club) -> some View {
        let tier = store.tier(for: club)

        return HStack(spacing: 14) {
            Image(systemName: "ticket.fill")
                .font(.title3)
                .foregroundStyle(Theme.orange)
                .frame(width: 44, height: 44)
                .background(Theme.orangeTint, in: .circle)

            VStack(alignment: .leading, spacing: 3) {
                Text("\(coupon.code) · \(coupon.discountLabel)")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.ink)
                if coupon.isOffered {
                    Text(tr("offered_by_the_assodarts_team"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                } else {
                    Text("\(Fmt.euros(tier.priceEuros)) → \(Fmt.money(coupon.discountedCents(fromEuros: tier.priceEuros)))")
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            Spacer()
        }
        .assoCard()
    }

    private func pricingGrid(_ club: Club) -> some View {
        let currentTier = store.tier(for: club)

        return VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("all_plans"))

            VStack(spacing: 0) {
                ForEach(PricingTier.all) { tier in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tier.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                            Text(tier.rangeLabel)
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        Spacer()
                        Text(tier.priceEuros > 0
                            ? tr("year_subscriptionview \(Fmt.euros(tier.priceEuros))")
                            : tr("custom_quote"))
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(tier.id == currentTier.id ? Theme.navy : Theme.inkSecondary)
                        if tier.id == currentTier.id {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Theme.navy)
                        }
                    }
                    .padding(.vertical, 10)

                    if tier.id != PricingTier.all.last?.id {
                        Divider().overlay(Theme.border)
                    }
                }
            }
            .assoCard(padding: 14)
        }
    }
}

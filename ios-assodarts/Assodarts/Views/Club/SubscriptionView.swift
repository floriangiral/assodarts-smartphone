import SwiftUI

/// The club's own Assodarts subscription: current plan, coupon and pricing grid.
struct SubscriptionView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        ScrollView {
            if let club = store.currentClub {
                VStack(spacing: 16) {
                    currentPlanCard(club)

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

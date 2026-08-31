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
                        Label("Facturation annuelle", systemImage: "info.circle")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text("Un seul paiement par an, tarif dégressif selon le nombre de membres. "
                            + "14 jours d'essai sans carte bancaire, puis 7 jours de lecture seule après expiration. "
                            + "Le paiement de l'abonnement sera activé prochainement.")
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
        .navigationTitle("Abonnement")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func currentPlanCard(_ club: Club) -> some View {
        let tier = store.tier(for: club)
        let priceCents = store.annualPriceCents(for: club)

        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Formule \(tier.name)")
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
                Text(priceCents == 0 && tier.priceEuros > 0 ? "Offert" : Fmt.money(priceCents))
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text("/ an")
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
                Label("\(store.memberCount(of: club)) membres", systemImage: "person.3.fill")
                Spacer()
                Label("Renouvellement le \(Fmt.shortDate(club.renewalDate))", systemImage: "arrow.clockwise")
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
                    Text("Offert par l'équipe Assodarts")
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
            SectionLabel(text: "Toutes les formules")

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
                        Text(tier.priceEuros > 0 ? "\(Fmt.euros(tier.priceEuros)) / an" : "Sur devis")
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

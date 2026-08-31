import SwiftUI

/// Global money view of the platform: revenue, tiers and granted discounts.
struct DevFinancesView: View {
    @Environment(AppStore.self) private var store

    private var activeClubs: [Club] {
        store.platformClubs.filter { $0.status == .active || $0.status == .grace }
    }

    private var renewals: Int {
        store.platformClubs.filter {
            $0.createdAt < (Calendar.current.date(byAdding: .year, value: -1, to: .now) ?? .now)
        }.count
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                DevHeaderBand(title: tr("Finances", "Finances"))

                heroCard
                monthlyCard
                tiersCard
                couponsCard

                Label(
                    tr(
                        "Hors paiements des clubs · encaissement Stripe bientôt disponible",
                        "Excludes club-level payments · Stripe collection coming soon"
                    ),
                    systemImage: "info.circle"
                )
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .toolbar(.hidden, for: .navigationBar)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(tr("Encaissé cette année", "Collected this year"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary)
            Text(Fmt.money(store.annualRevenueCents))
                .font(.system(size: 42, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Theme.navy)
            Text(tr(
                "\(renewals) renouvellements · \(activeClubs.count - renewals) premiers abonnements",
                "\(renewals) renewals · \(activeClubs.count - renewals) first subscriptions"
            ))
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
        }
        .assoCard(padding: 20)
    }

    private var monthlyCard: some View {
        let data = store.clubsPerMonth
        let maximum = max(data.map(\.count).max() ?? 1, 1)

        return VStack(alignment: .leading, spacing: 14) {
            Text(tr("Revenus par mois", "Revenue per month"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.ink)

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(data.enumerated()), id: \.offset) { index, point in
                    VStack(spacing: 6) {
                        VStack(spacing: 2) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Theme.orange)
                                .frame(height: max(4, CGFloat(point.count) / CGFloat(maximum) * 30))
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Theme.navy.opacity(0.8))
                                .frame(height: max(6, CGFloat(point.count) / CGFloat(maximum) * 62))
                        }
                        Text(point.label)
                            .font(.caption2)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 120, alignment: .bottom)

            HStack(spacing: 16) {
                legend(tr("Nouveaux", "New"), color: Theme.navy)
                legend(tr("Renouvellements", "Renewals"), color: Theme.orange)
            }
        }
        .assoCard(padding: 20)
    }

    private func legend(_ text: String, color: Color) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 12, height: 8)
            Text(text)
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
        }
    }

    private var tiersCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("Répartition par formule", "Split by plan"))
            VStack(spacing: 0) {
                let rows = store.revenueByTier
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(row.tier.name) \(row.tier.priceEuros > 0 ? Fmt.euros(row.tier.priceEuros) : tr("sur devis", "custom quote"))")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.ink)
                            Text(Fmt.count(row.clubs, "club", "clubs", "club", "clubs"))
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        Spacer()
                        Text(Fmt.money(row.cents))
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(Theme.ink)
                    }
                    .padding(.vertical, 10)

                    if index != rows.count - 1 {
                        Divider().overlay(Theme.border)
                    }
                }
            }
            .assoCard(padding: 14)
        }
    }

    private var couponsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("Coupons appliqués", "Coupons applied"))
            VStack(spacing: 0) {
                let coupons = store.db.coupons
                ForEach(Array(coupons.enumerated()), id: \.element.id) { index, coupon in
                    let clubs = store.clubsUsing(coupon)
                    let discount = clubs.reduce(0) { total, club in
                        let full = store.tier(for: club).priceEuros * 100
                        return total + (full - coupon.discountedCents(fromEuros: store.tier(for: club).priceEuros))
                    }

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(coupon.code) · \(coupon.discountLabel)")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.ink)
                            Text(Fmt.count(clubs.count, "club ciblé", "clubs ciblés", "club targeted", "clubs targeted"))
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        Spacer()
                        Text("−\(Fmt.money(discount))")
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(Theme.orange)
                    }
                    .padding(.vertical, 10)

                    if index != coupons.count - 1 {
                        Divider().overlay(Theme.border)
                    }
                }

                if coupons.isEmpty {
                    Text(tr("Aucun coupon actif.", "No active coupons."))
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                }
            }
            .assoCard(padding: 14)
        }
    }
}

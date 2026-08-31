import SwiftUI

/// Coupon console: create, target and revoke developer discount codes.
struct DevCouponsView: View {
    @Environment(AppStore.self) private var store
    @State private var showsComposer: Bool = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                DevHeaderBand(title: tr("Coupons", "Coupons"))

                PrimaryButton(title: tr("Créer un coupon", "Create a coupon"), symbol: "plus") {
                    showsComposer = true
                }

                if store.db.coupons.isEmpty {
                    ContentUnavailableView(
                        tr("Aucun coupon", "No coupons"),
                        systemImage: "ticket",
                        description: Text(tr(
                            "Créez un code de 10 % à 100 % et ciblez les clubs concernés.",
                            "Create a 10% to 100% code and target the clubs you want."
                        ))
                    )
                    .padding(.top, 40)
                }

                ForEach(store.db.coupons) { coupon in
                    couponCard(coupon)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsComposer) {
            NewCouponSheet()
        }
    }

    private func couponCard(_ coupon: Coupon) -> some View {
        let clubs = store.clubsUsing(coupon)

        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(coupon.code)
                    .font(.title3.bold())
                    .monospaced()
                    .foregroundStyle(Theme.ink)
                Spacer()
                StatusChip(
                    text: coupon.discountLabel,
                    tint: coupon.isOffered ? Theme.green : Theme.orange,
                    background: coupon.isOffered ? Theme.greenTint : Theme.orangeTint
                )
            }

            HStack(spacing: 14) {
                Label(Fmt.count(clubs.count, "club", "clubs", "club", "clubs"), systemImage: "building.2")
                Label(
                    coupon.isExpired
                        ? tr("Expiré", "Expired")
                        : tr(
                            "Jusqu'au \(Fmt.shortDate(coupon.expiresAt))",
                            "Until \(Fmt.shortDate(coupon.expiresAt))"
                        ),
                    systemImage: "calendar"
                )
                if coupon.autoRenew {
                    Label(tr("Renouvelé", "Renewing"), systemImage: "arrow.clockwise")
                }
            }
            .font(.caption)
            .foregroundStyle(Theme.inkSecondary)

            if !clubs.isEmpty {
                Divider().overlay(Theme.border)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(clubs) { club in
                        HStack {
                            Text(club.name)
                                .font(.footnote)
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            Text(Fmt.money(store.annualPriceCents(for: club)))
                                .font(.footnote.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(Theme.navy)
                        }
                    }
                }
            }

            Button(tr("Révoquer le coupon", "Revoke coupon"), role: .destructive) {
                store.deleteCoupon(coupon.id)
            }
            .font(.footnote.weight(.semibold))
            .padding(.top, 2)
        }
        .assoCard()
    }
}

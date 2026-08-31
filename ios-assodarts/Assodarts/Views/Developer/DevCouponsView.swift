import SwiftUI

/// Coupon console: create, target and revoke developer discount codes.
struct DevCouponsView: View {
    @Environment(AppStore.self) private var store
    @State private var showsComposer: Bool = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                DevHeaderBand(title: "Coupons")

                PrimaryButton(title: "Créer un coupon", symbol: "plus") {
                    showsComposer = true
                }

                if store.db.coupons.isEmpty {
                    ContentUnavailableView(
                        "Aucun coupon",
                        systemImage: "ticket",
                        description: Text("Créez un code de 10 % à 100 % et ciblez les clubs concernés.")
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
                Label("\(clubs.count) club\(clubs.count > 1 ? "s" : "")", systemImage: "building.2")
                Label(
                    coupon.isExpired ? "Expiré" : "Jusqu'au \(Fmt.shortDate(coupon.expiresAt))",
                    systemImage: "calendar"
                )
                if coupon.autoRenew {
                    Label("Renouvelé", systemImage: "arrow.clockwise")
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

            Button("Révoquer le coupon", role: .destructive) {
                store.deleteCoupon(coupon.id)
            }
            .font(.footnote.weight(.semibold))
            .padding(.top, 2)
        }
        .assoCard()
    }
}

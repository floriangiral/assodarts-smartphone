import SwiftUI

/// Coupon console: create, target and revoke developer discount codes.
struct DevCouponsView: View {
    @Environment(AppStore.self) private var store
    @State private var showsComposer: Bool = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                DevHeaderBand(title: tr("coupons"))

                PrimaryButton(title: tr("create_a_coupon"), symbol: "plus") {
                    showsComposer = true
                }

                    if store.platformCoupons.isEmpty {
                    EmptyStateView(
                        tr("no_coupons"),
                        systemImage: "ticket",
                        description: Text(tr("create_a_10_to_100_code_and_target_the_clubs_you_want"))
                    )
                    .padding(.top, 40)
                }

                    ForEach(store.platformCoupons) { coupon in
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
        .task { await store.loadPlatformData() }
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
                Label(Fmt.count(clubs.count, key: .clubs), systemImage: "building.2")
                Label(
                    coupon.isExpired
                        ? tr("expired")
                        : tr("until \(Fmt.shortDate(coupon.expiresAt))"),
                    systemImage: "calendar"
                )
                if coupon.autoRenew {
                    Label(tr("renewing"), systemImage: "arrow.clockwise")
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

            Button(tr("revoke_coupon"), role: .destructive) {
                    Task { await store.deleteCoupon(coupon.id) }
            }
            .font(.footnote.weight(.semibold))
            .padding(.top, 2)
        }
        .assoCard()
    }
}

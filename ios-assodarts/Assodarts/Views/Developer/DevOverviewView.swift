import SwiftUI

/// Global operations dashboard across every tenant of the platform.
struct DevOverviewView: View {
    @Environment(AppStore.self) private var store

    private var newClubsThisMonth: Int {
        let calendar = Calendar.current
        return store.platformClubs.filter {
            calendar.isDate($0.createdAt, equalTo: .now, toGranularity: .month)
        }.count
    }

    private var expiringTrials: [Club] {
        store.platformClubs.filter {
            $0.status == .trial && $0.renewalDate < (Calendar.current.date(byAdding: .day, value: 7, to: .now) ?? .now)
        }
    }

    private var graceClubs: [Club] {
        store.platformClubs.filter { $0.status == .grace || $0.status == .expired }
    }

    private var latestClubs: [Club] {
        store.platformClubs.sorted { $0.createdAt > $1.createdAt }.prefix(4).map { $0 }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                DevHeaderBand(title: tr("overview"))

                HStack(spacing: 12) {
                    MetricTile(
                        value: "\(store.totalClubs)",
                        label: tr("active_clubs"),
                        delta: newClubsThisMonth > 0
                            ? tr("this_month \(newClubsThisMonth)")
                            : nil
                    )
                    MetricTile(
                        value: store.totalMembers.formatted(.number.locale(Fmt.locale)),
                        label: tr("members")
                    )
                    MetricTile(
                        value: Fmt.money(store.annualRevenueCents),
                        label: tr("annual_revenue"),
                        tint: Theme.navy
                    )
                }

                chartCard
                alertsCard

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(text: tr("latest_clubs_signed_up"))
                    VStack(spacing: 0) {
                        ForEach(latestClubs) { club in
                            clubRow(club)
                            if club.id != latestClubs.last?.id {
                                Divider().overlay(Theme.border)
                            }
                        }
                    }
                    .assoCard(padding: 14)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .toolbar(.hidden, for: .navigationBar)
        .task { await store.loadPlatformData() }
    }

    private var chartCard: some View {
        let data = store.clubsPerMonth
        let maximum = max(data.map(\.count).max() ?? 1, 1)

        return VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(tr("new_clubs_per_month"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(tr("clubs_on_trial \(store.totalClubs) \(store.trialClubs)"))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(data.enumerated()), id: \.offset) { index, point in
                    VStack(spacing: 6) {
                        RoundedRectangle(cornerRadius: Theme.microRadius)
                            .fill(index == data.count - 1 ? Theme.orange : Theme.navy.opacity(0.75))
                            .frame(height: max(6, CGFloat(point.count) / CGFloat(maximum) * 92))
                        Text(point.label)
                            .font(.caption2)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 120, alignment: .bottom)
        }
        .assoCard(padding: 20)
    }

    private var alertsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("alerts"))

            HStack(spacing: 10) {
                Image(systemName: "hourglass")
                    .foregroundStyle(Theme.amber)
                Text(tr("expiring_trials_count \(expiringTrials.count)"))
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                Spacer()
                StatusChip(text: tr("trial"), tint: Theme.amber, background: Theme.amberTint)
            }

            Divider().overlay(Theme.border)

            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Theme.red)
                Text(tr("grace_subscriptions_count \(graceClubs.count)"))
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                Spacer()
                StatusChip(text: tr("read_only"), tint: Theme.red, background: Theme.redTint)
            }
        }
        .assoCard()
    }

    private func clubRow(_ club: Club) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(club.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Text(tr("members_year \(store.memberCount(of: club)) \(Fmt.euros(store.tier(for: club).priceEuros))"))
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: 4)
            StatusChip(
                text: club.status == .trial
                    ? tr("trial")
                    : club.status == .active ? tr("active") : tr("grace"),
                tint: club.status == .active ? Theme.green : Theme.amber,
                background: club.status == .active ? Theme.greenTint : Theme.amberTint
            )
        }
        .padding(.vertical, 9)
    }
}

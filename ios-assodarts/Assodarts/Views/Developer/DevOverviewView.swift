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
                DevHeaderBand(title: "Vue d'ensemble")

                HStack(spacing: 12) {
                    MetricTile(
                        value: "\(store.totalClubs)",
                        label: "Clubs actifs",
                        delta: newClubsThisMonth > 0 ? "+\(newClubsThisMonth) ce mois" : nil
                    )
                    MetricTile(
                        value: store.totalMembers.formatted(.number.locale(Fmt.locale)),
                        label: "Membres"
                    )
                    MetricTile(
                        value: Fmt.money(store.annualRevenueCents),
                        label: "Revenu annuel",
                        tint: Theme.navy
                    )
                }

                chartCard
                alertsCard

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(text: "Derniers clubs inscrits")
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
    }

    private var chartCard: some View {
        let data = store.clubsPerMonth
        let maximum = max(data.map(\.count).max() ?? 1, 1)

        return VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Nouveaux clubs par mois")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text("\(store.totalClubs) clubs · \(store.trialClubs) en essai")
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(data.enumerated()), id: \.offset) { index, point in
                    VStack(spacing: 6) {
                        RoundedRectangle(cornerRadius: 4)
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
            SectionLabel(text: "Alertes")

            HStack(spacing: 10) {
                Image(systemName: "hourglass")
                    .foregroundStyle(Theme.amber)
                Text("\(expiringTrials.count) essai\(expiringTrials.count > 1 ? "s" : "") expire\(expiringTrials.count > 1 ? "nt" : "") sous 7 jours")
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                Spacer()
                StatusChip(text: "Essai", tint: Theme.amber, background: Theme.amberTint)
            }

            Divider().overlay(Theme.border)

            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Theme.red)
                Text("\(graceClubs.count) abonnement\(graceClubs.count > 1 ? "s" : "") en délai de grâce")
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                Spacer()
                StatusChip(text: "Lecture seule", tint: Theme.red, background: Theme.redTint)
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
                Text("\(store.memberCount(of: club)) membres · \(Fmt.euros(store.tier(for: club).priceEuros))/an")
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: 4)
            StatusChip(
                text: club.status == .trial ? "Essai" : club.status == .active ? "Actif" : "Grâce",
                tint: club.status == .active ? Theme.green : Theme.amber,
                background: club.status == .active ? Theme.greenTint : Theme.amberTint
            )
        }
        .padding(.vertical, 9)
    }
}

import SwiftUI

/// Role-adaptive home of the club space.
struct DashboardView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        ScrollView {
            if let user = store.currentUser, let club = store.currentClub {
                VStack(spacing: 18) {
                    DashboardHeader(user: user, subtitle: club.name)
                        .padding(.bottom, 2)

                    if user.role.canManageClub {
                        AdminDashboardContent(user: user, club: club)
                    } else {
                        MemberDashboardContent(user: user, club: club)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
        }
        .assoCanvas()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .clubDestinations()
    }
}

/// Banner surfacing the latest platform announcement from the developer.
struct PlatformNoticeCard: View {
    let announcement: PlatformAnnouncement

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .foregroundStyle(Theme.orange)
                Text("Assodarts")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.orange)
                Spacer()
                Text(Fmt.shortDate(announcement.publishedAt))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }
            Text(announcement.title)
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Text(announcement.body)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
                .lineLimit(3)
        }
        .assoCard()
    }
}

/// Compact metric tile used on both dashboards.
struct MetricTile: View {
    let value: String
    let label: String
    var delta: String?
    var tint: Color = Theme.ink

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title2.bold())
                .monospacedDigit()
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
                .lineLimit(2)
            if let delta {
                Text(delta)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.orange)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.cardRadius))
        .overlay {
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.border, lineWidth: 1)
        }
    }
}

/// Row summarising an upcoming event on the dashboards.
struct EventSummaryCard: View {
    let event: ClubEvent
    let attendingCount: Int

    var body: some View {
        HStack(spacing: 14) {
            VStack(spacing: 2) {
                Text(event.date.formatted(.dateTime.locale(Fmt.locale).day()))
                    .font(.title3.bold())
                    .monospacedDigit()
                Text(event.date.formatted(.dateTime.locale(Fmt.locale).month(.abbreviated)))
                    .font(.caption2.weight(.semibold))
                    .textCase(.uppercase)
            }
            .foregroundStyle(Theme.navy)
            .frame(width: 52, height: 56)
            .background(Theme.navyTint, in: .rect(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 3) {
                Text(event.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text("\(Fmt.time(event.date)) · \(event.location)")
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
                    .lineLimit(1)
                Text("\(attendingCount) présents")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(Theme.green)
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(Theme.inkSecondary.opacity(0.6))
        }
    }
}

#Preview {
    NavigationStack {
        DashboardView()
    }
    .environment(AppStore())
}

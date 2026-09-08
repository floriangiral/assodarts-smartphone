import SwiftUI

/// What a simple member sees on the home screen.
struct MemberDashboardContent: View {
    let user: Member
    let club: Club

    @Environment(AppStore.self) private var store

    private var dueCents: Int { store.dueCents(for: user.id) }
    private var duePayments: [(call: PaymentCall, item: PaymentItem)] {
        store.payments(for: user.id).filter { !$0.item.isPaid }
    }
    private var nextEvent: ClubEvent? { store.upcomingEvents(of: club.id).first }
    private var latestAnnouncements: [Announcement] {
        Array(store.announcements(of: club.id).prefix(2))
    }

    var body: some View {
        VStack(spacing: 18) {
            licenceCard

            if dueCents > 0 {
                paymentCard
            } else {
                upToDateCard
            }

            if let nextEvent {
                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(text: tr("next_date"))
                    NavigationLink(value: ClubRoute.event(nextEvent.id)) {
                        EventSummaryCard(event: nextEvent, attendingCount: nextEvent.attendeeIds.count)
                    }
                    .buttonStyle(.plain)
                }
                .assoCard()
            }

            seasonCard

            if !latestAnnouncements.isEmpty {
                announcementsCard
            }

            if let notice = store.visiblePlatformAnnouncements(for: user).first {
                PlatformNoticeCard(announcement: notice)
            }
        }
    }

    private var licenceCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(
                    user.isLicensed ? tr("ffd_licence") : tr("standard_member"),
                    systemImage: user.isLicensed ? "checkmark.seal.fill" : "person.crop.circle"
                )
                .font(.caption.weight(.bold))
                .foregroundStyle(Theme.orange)
                Spacer()
                StatusChip(state: store.membershipState(for: user.id))
            }

            if user.isLicensed, !user.licenceNumber.isEmpty {
                Text(user.licenceNumber)
                    .font(.title2.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text(tr("20262027_season_valid_until_31_august_2027"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            } else {
                Text(tr("no_licence_number"))
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(tr("the_committee_can_add_your_licence_from_your_member_reco"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .assoCard()
    }

    private var paymentCard: some View {
        NavigationLink(value: ClubRoute.myPayments) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text(tr("due"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                }

                MetricNumber(value: Fmt.money(dueCents), color: Theme.orange)
                    .contentTransition(.numericText())

                Text(Fmt.count(duePayments.count, key: .duePayments))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)

                if let first = duePayments.first {
                    Divider().overlay(Theme.border)
                    HStack {
                        Image(systemName: first.call.category.symbol)
                            .foregroundStyle(Theme.navy)
                        Text(first.call.label)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        StatusChip(state: first.item.state(dueDate: first.call.dueDate))
                    }
                }
            }
            .assoCard()
        }
        .buttonStyle(.plain)
    }

    private var upToDateCard: some View {
        NavigationLink(value: ClubRoute.myPayments) {
            HStack(spacing: 14) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title)
                    .foregroundStyle(Theme.green)
                VStack(alignment: .leading, spacing: 2) {
                    Text(tr("you_re_all_set"))
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text(tr("no_pending_payment"))
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.6))
            }
            .assoCard()
        }
        .buttonStyle(.plain)
    }

    private var seasonCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("my_season"))
            HStack(spacing: 12) {
                MetricTile(value: "\(user.eventsAttended)", label: tr("events"))
                MetricTile(value: "\(user.tournamentsPlayed)", label: tr("tournaments"))
                MetricTile(
                    value: user.average.formatted(.number.locale(Fmt.locale).precision(.fractionLength(1))),
                    label: tr("average"),
                    tint: Theme.navy
                )
            }
        }
    }

    private var announcementsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("latest_news"))
            VStack(spacing: 0) {
                ForEach(latestAnnouncements) { announcement in
                    NavigationLink(value: ClubRoute.announcement(announcement.id)) {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: announcement.isPinned ? "pin.fill" : "megaphone.fill")
                                .font(.footnote)
                                .foregroundStyle(announcement.isPinned ? Theme.orange : Theme.navy)
                                .frame(width: 22)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(announcement.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.ink)
                                    .multilineTextAlignment(.leading)
                                Text(announcement.body)
                                    .font(.caption)
                                    .foregroundStyle(Theme.inkSecondary)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 10)
                    }
                    .buttonStyle(.plain)

                    if announcement.id != latestAnnouncements.last?.id {
                        Divider().overlay(Theme.border)
                    }
                }
            }
            .assoCard(padding: 14)
        }
    }
}

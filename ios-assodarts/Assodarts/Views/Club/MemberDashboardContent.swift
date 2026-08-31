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
                    SectionLabel(text: tr("Prochain rendez-vous", "Next date"))
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
                    user.isLicensed ? tr("Licence FFD", "FFD licence") : tr("Membre simple", "Standard member"),
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
                Text(tr(
                    "Saison 2026–2027 · valable jusqu'au 31 août 2027",
                    "2026–2027 season · valid until 31 August 2027"
                ))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            } else {
                Text(tr("Aucun numéro de licence", "No licence number"))
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(tr(
                    "Le bureau peut enregistrer votre licence depuis votre fiche membre.",
                    "The committee can add your licence from your member record."
                ))
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
                    Text(tr("À régler", "Due"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                }

                Text(Fmt.money(dueCents))
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Theme.orange)
                    .contentTransition(.numericText())

                Text(Fmt.count(
                    duePayments.count,
                    "paiement en attente",
                    "paiements en attente",
                    "pending payment",
                    "pending payments"
                ))
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
                    Text(tr("Vous êtes à jour", "You're all set"))
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text(tr("Aucun paiement en attente", "No pending payment"))
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
            SectionLabel(text: tr("Ma saison", "My season"))
            HStack(spacing: 12) {
                MetricTile(value: "\(user.eventsAttended)", label: tr("Événements", "Events"))
                MetricTile(value: "\(user.tournamentsPlayed)", label: tr("Tournois", "Tournaments"))
                MetricTile(
                    value: user.average.formatted(.number.locale(Fmt.locale).precision(.fractionLength(1))),
                    label: tr("Moyenne", "Average"),
                    tint: Theme.navy
                )
            }
        }
    }

    private var announcementsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("Dernières annonces", "Latest news"))
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

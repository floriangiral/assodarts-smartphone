import SwiftUI

/// What a bureau member or club admin sees on the home screen.
struct AdminDashboardContent: View {
    let user: Member
    let club: Club

    @Environment(AppStore.self) private var store

    @State private var showsNewPaymentCall: Bool = false
    @State private var showsNewAnnouncement: Bool = false
    @State private var showsInvite: Bool = false

    private var members: [Member] { store.members(of: club.id) }
    private var licensedCount: Int { members.filter(\.isLicensed).count }
    private var upToDateCount: Int { members.filter { store.isUpToDate($0.id) }.count }

    private var openCalls: [PaymentCall] {
        store.paymentCalls(of: club.id).filter { $0.unpaidCount > 0 }
    }

    private var collectedCents: Int {
        store.paymentCalls(of: club.id).reduce(0) { $0 + $1.collectedCents }
    }

    private var outstandingCents: Int {
        openCalls.reduce(0) { $0 + ($1.amountCents * $1.unpaidCount) }
    }

    private var lateMembers: [(call: PaymentCall, item: PaymentItem)] {
        store.paymentCalls(of: club.id)
            .flatMap { call in call.items.map { (call, $0) } }
            .filter { $0.1.state(dueDate: $0.0.dueDate) == .late }
    }

    private var nextEvent: ClubEvent? { store.upcomingEvents(of: club.id).first }

    private var validationCount: Int { store.pendingValidationCount(of: club.id) }
    private var validationCents: Int { store.pendingValidationCents(of: club.id) }
    private var bank: ClubBankAccount? { club.bank }

    var body: some View {
        VStack(spacing: 18) {
            metrics
            collectionCard

            if validationCount > 0 {
                validationCard
            }

            if bank?.isComplete != true || bank?.canCollectOnline != true {
                bankSetupCard
            }

            quickActions

            if !lateMembers.isEmpty {
                alertsCard
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

            subscriptionCard

            if let notice = store.visiblePlatformAnnouncements(for: user).first {
                PlatformNoticeCard(announcement: notice)
            }
        }
        .sheet(isPresented: $showsNewPaymentCall) {
            NewPaymentCallSheet()
        }
        .sheet(isPresented: $showsNewAnnouncement) {
            NewAnnouncementSheet()
        }
        .sheet(isPresented: $showsInvite) {
            InviteMemberSheet()
        }
    }

    private var metrics: some View {
        HStack(spacing: 12) {
            MetricTile(value: "\(members.count)", label: tr("Membres", "Members"))
            MetricTile(value: "\(licensedCount)", label: tr("Licenciés", "Licensed"))
            MetricTile(
                value: "\(upToDateCount)/\(members.count)",
                label: tr("Cotisations à jour", "Fees up to date"),
                tint: upToDateCount == members.count ? Theme.green : Theme.ink
            )
        }
    }

    private var collectionCard: some View {
        NavigationLink(value: ClubRoute.paymentCalls) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text(tr("Encaissements du club", "Club collections"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                }

                Text(Fmt.money(collectedCents))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)

                HStack(spacing: 16) {
                    Label(
                        tr(
                            "\(Fmt.money(outstandingCents)) en attente",
                            "\(Fmt.money(outstandingCents)) outstanding"
                        ),
                        systemImage: "clock.badge.exclamationmark"
                    )
                    .font(.caption.weight(.medium))
                    .foregroundStyle(outstandingCents > 0 ? Theme.amber : Theme.green)

                    Text(Fmt.count(
                        openCalls.count,
                        "appel en cours",
                        "appels en cours",
                        "open request",
                        "open requests"
                    ))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .assoCard()
        }
        .buttonStyle(.plain)
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("Actions du bureau", "Committee actions"))
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                actionTile(tr("Appel à paiement", "Payment request"), symbol: "eurosign.circle.fill", tint: Theme.navy) {
                    showsNewPaymentCall = true
                }
                actionTile(tr("Nouvelle annonce", "New announcement"), symbol: "megaphone.fill", tint: Theme.orange) {
                    showsNewAnnouncement = true
                }
                actionTile(tr("Inviter un membre", "Invite a member"), symbol: "person.badge.plus", tint: Theme.green) {
                    showsInvite = true
                }
                NavigationLink(value: ClubRoute.messages) {
                    actionTileLabel(
                        tr("Messagerie", "Messages"),
                        symbol: "bubble.left.and.bubble.right.fill",
                        tint: Theme.navy
                    )
                }
                .buttonStyle(.plain)
                NavigationLink(value: ClubRoute.bankSettings) {
                    actionTileLabel(
                        tr("Coordonnées bancaires", "Bank details"),
                        symbol: "building.columns.fill",
                        tint: Theme.navy
                    )
                }
                .buttonStyle(.plain)
                NavigationLink(value: ClubRoute.paymentValidation) {
                    actionTileLabel(
                        tr("Valider les paiements", "Confirm payments"),
                        symbol: "checkmark.seal.fill",
                        tint: Theme.orange
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func actionTile(
        _ title: String,
        symbol: String,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            actionTileLabel(title, symbol: symbol, tint: tint)
        }
        .buttonStyle(PressableButtonStyle())
    }

    private func actionTileLabel(_ title: String, symbol: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(tint)
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .frame(height: 96)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.cardRadius))
        .overlay {
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.border, lineWidth: 1)
        }
    }

    /// Transfers and cash declared by members, waiting for the bureau.
    private var validationCard: some View {
        NavigationLink(value: ClubRoute.paymentValidation) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label(tr("Paiements à valider", "Payments to confirm"), systemImage: "clock.badge.checkmark")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.navy)
                    Spacer()
                    Text("\(validationCount)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Theme.navy, in: .capsule)
                }

                Text(tr(
                    "\(Fmt.money(validationCents)) déclarés par virement ou espèces",
                    "\(Fmt.money(validationCents)) declared by transfer or cash"
                ))
                    .font(.title3.bold())
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)

                Text(tr(
                    "Confirmez la réception pour marquer ces membres comme payés.",
                    "Confirm receipt to mark these members as paid."
                ))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }
            .assoCard()
        }
        .buttonStyle(.plain)
    }

    /// Nudge shown until the club can actually receive money.
    private var bankSetupCard: some View {
        NavigationLink(value: ClubRoute.bankSettings) {
            HStack(spacing: 14) {
                Image(systemName: "building.columns.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.orange)
                    .frame(width: 44, height: 44)
                    .background(Theme.orangeTint, in: .circle)

                VStack(alignment: .leading, spacing: 3) {
                    Text(bank?.isComplete == true
                         ? tr("Activez les paiements en ligne", "Activate online payments")
                         : tr("Renseignez vos coordonnées bancaires", "Add your bank details"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Text(bank?.isComplete == true
                         ? tr(
                            "Apple Pay, Google Pay et carte après vérification du compte.",
                            "Apple Pay, Google Pay and card once the account is verified."
                         )
                         : tr(
                            "IBAN et BIC du club pour encaisser virements et paiements en ligne.",
                            "The club IBAN and BIC to collect transfers and online payments."
                         ))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.6))
            }
            .assoCard()
        }
        .buttonStyle(.plain)
    }

    private var alertsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(tr("Alertes", "Alerts"), systemImage: "exclamationmark.triangle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.red)
                Spacer()
                Text("\(lateMembers.count)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.red)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.redTint, in: .capsule)
            }

            ForEach(Array(lateMembers.prefix(3).enumerated()), id: \.offset) { _, entry in
                NavigationLink(value: ClubRoute.paymentCall(entry.call.id)) {
                    HStack(spacing: 10) {
                        Text(store.memberName(entry.item.memberId))
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Text(entry.call.label)
                            .font(.caption)
                            .foregroundStyle(Theme.inkSecondary)
                            .lineLimit(1)
                        Text(Fmt.money(entry.call.amountCents))
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(Theme.red)
                    }
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
            }
        }
        .assoCard()
    }

    private var subscriptionCard: some View {
        NavigationLink(value: ClubRoute.subscription) {
            HStack(spacing: 14) {
                Image(systemName: "creditcard.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.navy)
                    .frame(width: 44, height: 44)
                    .background(Theme.navyTint, in: .circle)
                VStack(alignment: .leading, spacing: 2) {
                    Text(tr("Abonnement du club", "Club subscription"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Text("\(store.tier(for: club).name) · \(club.status.label)")
                        .font(.caption)
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
}

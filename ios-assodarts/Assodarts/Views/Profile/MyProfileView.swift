import SwiftUI

/// The signed-in member's own profile: identity, licence, season and payments.
struct MyProfileView: View {
    @Environment(AppStore.self) private var store
    @Environment(Localization.self) private var localization
    @State private var showsEditor: Bool = false
    @State private var showsSignOutAlert: Bool = false

    private var payments: [(call: PaymentCall, item: PaymentItem)] {
        guard let user = store.currentUser else { return [] }
        return store.payments(for: user.id)
    }

    var body: some View {
        ScrollView {
            if let user = store.currentUser, let club = store.currentClub {
                VStack(spacing: 16) {
                    identityCard(user, club: club)
                    licenceCard(user)
                    seasonCard(user)
                    paymentsCard
                    notificationsCard(user)
                    languageCard

                    VStack(spacing: 12) {
                        SecondaryButton(title: tr("Modifier mon profil", "Edit my profile"), symbol: "pencil") {
                            showsEditor = true
                        }
                        Button(tr("Se déconnecter", "Sign out")) {
                            showsSignOutAlert = true
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.red)
                        .padding(.top, 4)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }
        }
        .assoCanvas()
        .navigationTitle(tr("Mon profil", "My profile"))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsEditor) {
            EditProfileSheet()
        }
        .alert(tr("Se déconnecter ?", "Sign out?"), isPresented: $showsSignOutAlert) {
            Button(tr("Annuler", "Cancel"), role: .cancel) {}
            Button(tr("Se déconnecter", "Sign out"), role: .destructive) { store.signOut() }
        }
    }

    /// Language preference: follows the device by default, overridable here.
    private var languageCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: tr("Langue de l'application", "App language"))

            Picker(tr("Langue", "Language"), selection: Binding(
                get: { localization.preference },
                set: { localization.preference = $0 }
            )) {
                ForEach(AppLanguage.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            Text(localization.preference == .system
                ? tr(
                    "La langue suit celle de votre appareil : \(localization.lang == .fr ? "français" : "anglais").",
                    "The language follows your device: \(localization.lang == .fr ? "French" : "English")."
                )
                : tr(
                    "Dates, montants et clavier suivent cette langue.",
                    "Dates, amounts and keyboard follow this language."
                ))
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
        }
        .assoCard()
    }

    private func identityCard(_ user: Member, club: Club) -> some View {
        VStack(spacing: 14) {
            AvatarView(initials: user.initials, photoData: user.photoData, size: 88)

            VStack(spacing: 4) {
                Text(user.fullName)
                    .font(.title3.bold())
                    .foregroundStyle(Theme.ink)
                Text(tr(
                    "\(club.name) · membre depuis \(Fmt.shortDate(user.joinedAt))",
                    "\(club.name) · member since \(Fmt.shortDate(user.joinedAt))"
                ))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 8) {
                RoleBadge(role: user.role)
                StatusChip(
                    text: store.isUpToDate(user.id)
                        ? tr("Cotisation à jour", "Fee up to date")
                        : tr("Cotisation en attente", "Fee pending"),
                    tint: store.isUpToDate(user.id) ? Theme.green : Theme.amber,
                    background: store.isUpToDate(user.id) ? Theme.greenTint : Theme.amberTint
                )
            }
        }
        .assoCard(padding: 20)
    }

    private func licenceCard(_ user: Member) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(
                user.isLicensed
                    ? tr("Licence FFD · \(user.licenceLabel)", "FFD licence · \(user.licenceLabel)")
                    : tr("Membre simple", "Standard member"),
                systemImage: user.isLicensed ? "checkmark.seal.fill" : "person.crop.circle"
            )
            .font(.caption.weight(.bold))
            .foregroundStyle(Theme.orange)

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
                Text(tr("Aucun numéro enregistré", "No number on file"))
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Text(tr(
                    "Le bureau du club peut renseigner votre numéro de licence.",
                    "The club committee can fill in your licence number."
                ))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .assoCard()
    }

    private func seasonCard(_ user: Member) -> some View {
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

    private var paymentsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionLabel(text: tr("Mes paiements", "My payments"))
                NavigationLink(value: ClubRoute.myPayments) {
                    Text(tr("Tout voir", "See all"))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.navy)
                }
            }

            ForEach(Array(payments.prefix(3).enumerated()), id: \.element.item.id) { index, entry in
                VStack(spacing: 0) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.call.label)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.ink)
                            Text(Fmt.money(entry.call.amountCents))
                                .font(.caption)
                                .monospacedDigit()
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        Spacer()
                        StatusChip(state: entry.item.state(dueDate: entry.call.dueDate))
                    }
                    .padding(.vertical, 8)

                    if index != min(payments.count, 3) - 1 {
                        Divider().overlay(Theme.border)
                    }
                }
            }

            if payments.isEmpty {
                Text(tr("Aucun paiement pour l'instant.", "No payments yet."))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .assoCard()
    }

    private func notificationsCard(_ user: Member) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: tr("Notifications", "Notifications"))
            preferenceRow(tr("Annonces du club", "Club announcements"), isOn: user.notifyAnnouncements)
            preferenceRow(tr("Événements et convocations", "Events and call-ups"), isOn: user.notifyEvents)
            preferenceRow(tr("Appels à paiement", "Payment requests"), isOn: user.notifyPayments)
            preferenceRow(tr("Résultats de tournois", "Tournament results"), isOn: user.notifyTournaments)
        }
        .assoCard()
    }

    private func preferenceRow(_ label: String, isOn: Bool) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Theme.ink)
            Spacer()
            Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isOn ? Theme.green : Theme.inkSecondary.opacity(0.4))
        }
    }
}

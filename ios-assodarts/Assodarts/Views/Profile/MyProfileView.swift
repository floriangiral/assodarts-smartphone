import SwiftUI

/// The signed-in member's own profile: identity, licence, season and payments.
struct MyProfileView: View {
    @Environment(AppStore.self) private var store
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

                    VStack(spacing: 12) {
                        SecondaryButton(title: "Modifier mon profil", symbol: "pencil") {
                            showsEditor = true
                        }
                        Button("Se déconnecter") {
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
        .navigationTitle("Mon profil")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsEditor) {
            EditProfileSheet()
        }
        .alert("Se déconnecter ?", isPresented: $showsSignOutAlert) {
            Button("Annuler", role: .cancel) {}
            Button("Se déconnecter", role: .destructive) { store.signOut() }
        }
    }

    private func identityCard(_ user: Member, club: Club) -> some View {
        VStack(spacing: 14) {
            AvatarView(initials: user.initials, photoData: user.photoData, size: 88)

            VStack(spacing: 4) {
                Text(user.fullName)
                    .font(.title3.bold())
                    .foregroundStyle(Theme.ink)
                Text("\(club.name) · membre depuis \(Fmt.shortDate(user.joinedAt))")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 8) {
                RoleBadge(role: user.role)
                StatusChip(
                    text: store.isUpToDate(user.id) ? "Cotisation à jour" : "Cotisation en attente",
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
                user.isLicensed ? "Licence FFD · \(user.licenceLabel)" : "Membre simple",
                systemImage: user.isLicensed ? "checkmark.seal.fill" : "person.crop.circle"
            )
            .font(.caption.weight(.bold))
            .foregroundStyle(Theme.orange)

            if user.isLicensed, !user.licenceNumber.isEmpty {
                Text(user.licenceNumber)
                    .font(.title2.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text("Saison 2026–2027 · valable jusqu'au 31 août 2027")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            } else {
                Text("Aucun numéro enregistré")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Text("Le bureau du club peut renseigner votre numéro de licence.")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .assoCard()
    }

    private func seasonCard(_ user: Member) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: "Ma saison")
            HStack(spacing: 12) {
                MetricTile(value: "\(user.eventsAttended)", label: "Événements")
                MetricTile(value: "\(user.tournamentsPlayed)", label: "Tournois")
                MetricTile(
                    value: user.average.formatted(.number.locale(Fmt.locale).precision(.fractionLength(1))),
                    label: "Moyenne",
                    tint: Theme.navy
                )
            }
        }
    }

    private var paymentsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionLabel(text: "Mes paiements")
                NavigationLink(value: ClubRoute.myPayments) {
                    Text("Tout voir")
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
                Text("Aucun paiement pour l'instant.")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .assoCard()
    }

    private func notificationsCard(_ user: Member) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "Notifications")
            preferenceRow("Annonces du club", isOn: user.notifyAnnouncements)
            preferenceRow("Événements et convocations", isOn: user.notifyEvents)
            preferenceRow("Appels à paiement", isOn: user.notifyPayments)
            preferenceRow("Résultats de tournois", isOn: user.notifyTournaments)
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

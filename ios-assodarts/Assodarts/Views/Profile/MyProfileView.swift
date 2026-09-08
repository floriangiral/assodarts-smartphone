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
                        SecondaryButton(title: tr("edit_my_profile"), symbol: "pencil") {
                            showsEditor = true
                        }
                        Button(tr("sign_out")) {
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
        .navigationTitle(tr("my_profile"))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsEditor) {
            EditProfileSheet()
        }
        .alert(tr("sign_out_developertabview"), isPresented: $showsSignOutAlert) {
            Button(tr("cancel"), role: .cancel) {}
            Button(tr("sign_out"), role: .destructive) { store.signOut() }
        }
    }

    /// Language preference: follows the device by default, overridable here.
    private var languageCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: tr("app_language"))

            Picker(tr("language"), selection: Binding(
                get: { localization.preference },
                set: { localization.preference = $0 }
            )) {
                ForEach(AppLanguage.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            Text(localization.preference == .system
                ? tr("the_language_follows_your_device \(localization.lang == .fr ? "French" : "English")")
                : tr("dates_amounts_and_keyboard_follow_this_language"))
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
                Text(tr("member_since \(club.name) \(Fmt.shortDate(user.joinedAt))"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 8) {
                RoleBadge(role: user.role)
                StatusChip(
                    text: store.isUpToDate(user.id)
                        ? tr("fee_up_to_date")
                        : tr("fee_pending"),
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
                    ? tr("ffd_licence_myprofileview \(user.licenceLabel)")
                    : tr("standard_member"),
                systemImage: user.isLicensed ? "checkmark.seal.fill" : "person.crop.circle"
            )
            .font(.caption.weight(.bold))
            .foregroundStyle(Theme.orange)

            if user.isLicensed, !user.licenceNumber.isEmpty {
                Text(user.licenceNumber)
                    .font(.title2.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text(tr("20262027_season_valid_until_31_august_2027"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            } else {
                Text(tr("no_number_on_file"))
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Text(tr("the_club_committee_can_fill_in_your_licence_number"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .assoCard()
    }

    private func seasonCard(_ user: Member) -> some View {
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

    private var paymentsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionLabel(text: tr("my_payments"))
                NavigationLink(value: ClubRoute.myPayments) {
                    Text(tr("see_all"))
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
                Text(tr("no_payments_yet"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .assoCard()
    }

    private func notificationsCard(_ user: Member) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: tr("notifications"))
            preferenceRow(tr("club_announcements"), isOn: user.notifyAnnouncements)
            preferenceRow(tr("events_and_call_ups"), isOn: user.notifyEvents)
            preferenceRow(tr("payment_requests"), isOn: user.notifyPayments)
            preferenceRow(tr("tournament_results"), isOn: user.notifyTournaments)
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

import SwiftUI

/// Club directory with membership status, searchable and filterable.
struct MembersView: View {
    @Environment(AppStore.self) private var store

    @State private var search: String = ""
    @State private var filter: MemberFilter = .all
    @State private var showsInvite: Bool = false
    @State private var showsPaymentCall: Bool = false

    enum MemberFilter: String, CaseIterable, Identifiable {
        case all
        case licensed
        case late

        var id: String { rawValue }

        var label: String {
            switch self {
            case .all: tr("Tous", "All")
            case .licensed: tr("Licenciés", "Licensed")
            case .late: tr("À relancer", "To chase")
            }
        }
    }

    private var members: [Member] {
        guard let club = store.currentClub else { return [] }
        var list = store.members(of: club.id)
        switch filter {
        case .all: break
        case .licensed: list = list.filter(\.isLicensed)
        case .late: list = list.filter { !store.isUpToDate($0.id) }
        }
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return list }
        return list.filter { $0.fullName.localizedStandardContains(query) || $0.email.localizedStandardContains(query) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Picker(tr("Filtre", "Filter"), selection: $filter) {
                    ForEach(MemberFilter.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.segmented)

                if store.canManageClub {
                    HStack(spacing: 12) {
                        SecondaryButton(title: tr("Inviter", "Invite"), symbol: "person.badge.plus") {
                            showsInvite = true
                        }
                        SecondaryButton(title: tr("Appel à paiement", "Payment request"), symbol: "eurosign.circle") {
                            showsPaymentCall = true
                        }
                    }
                }

                VStack(spacing: 0) {
                    ForEach(members) { member in
                        NavigationLink(value: ClubRoute.memberProfile(member.id)) {
                            MemberRow(member: member, state: store.membershipState(for: member.id))
                        }
                        .buttonStyle(.plain)

                        if member.id != members.last?.id {
                            Divider().overlay(Theme.border).padding(.leading, 58)
                        }
                    }
                }
                .assoCard(padding: 14)

                if members.isEmpty {
                    ContentUnavailableView.search(text: search)
                        .padding(.top, 40)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .navigationTitle(tr("Membres", "Members"))
        .searchable(text: $search, prompt: tr("Rechercher un membre", "Search for a member"))
        .sheet(isPresented: $showsInvite) {
            InviteMemberSheet()
        }
        .sheet(isPresented: $showsPaymentCall) {
            NewPaymentCallSheet()
        }
        .clubDestinations()
    }
}

/// One row of the club directory.
struct MemberRow: View {
    let member: Member
    let state: PaymentState

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(initials: member.initials, photoData: member.photoData, size: 44)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(member.fullName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    if member.role != .membre {
                        RoleBadge(role: member.role)
                    }
                }
                HStack(spacing: 6) {
                    Image(systemName: member.isLicensed ? "checkmark.seal.fill" : "person.crop.circle")
                        .font(.caption2)
                        .foregroundStyle(member.isLicensed ? Theme.orange : Theme.inkSecondary)
                    Text(member.isLicensed
                        ? tr("Licencié · \(member.licenceNumber)", "Licensed · \(member.licenceNumber)")
                        : tr("Membre simple", "Standard member"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 4)

            StatusChip(
                text: state == .paid ? tr("À jour", "Up to date") : state.label,
                tint: state.tint,
                background: state.background
            )
        }
        .padding(.vertical, 9)
    }
}

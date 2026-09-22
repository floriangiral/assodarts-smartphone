import SwiftUI

/// Club directory with membership status, searchable and filterable.
struct MembersView: View {
    @Environment(AppStore.self) private var store

    @State private var search: String = ""
    @State private var filter: MemberFilter = .active
    @State private var showsInvite: Bool = false
    @State private var showsPaymentCall: Bool = false
    @State private var showsContributionSeason: Bool = false

    enum MemberFilter: String, CaseIterable, Identifiable {
        case active
        case committee
        case unlicensed
        case feeDue

        var id: String { rawValue }

        var label: String {
            switch self {
            case .active: tr("active_members")
            case .committee: tr("committee")
            case .unlicensed: tr("without_license")
            case .feeDue: tr("fee_to_chase")
            }
        }
    }

    private var members: [Member] {
        guard let club = store.currentClub else { return [] }
        var list = store.members(of: club.id)
        switch filter {
        case .active: break
        case .committee: list = list.filter { $0.role.canManageClub }
        case .unlicensed: list = list.filter { !$0.isLicensed }
        case .feeDue: list = list.filter(hasChasableMembershipFee)
        }
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return list }
        return list.filter { $0.fullName.localizedStandardContains(query) || $0.email.localizedStandardContains(query) }
    }

    private func hasChasableMembershipFee(_ member: Member) -> Bool {
        store.payments(for: member.id)
            .filter { $0.call.category == .cotisation }
            .contains { !$0.item.isPaid && $0.item.declaredAt == nil }
    }

    private func feeChip(for member: Member) -> (text: String, tint: Color, background: Color) {
        let fees = store.payments(for: member.id).filter { $0.call.category == .cotisation }
        guard !fees.isEmpty else {
            return (tr("fee_not_requested"), Theme.inkSecondary, Theme.canvas)
        }

        let state = store.membershipState(for: member.id)
        switch state {
        case .paid:
            return (tr("fee_up_to_date"), state.tint, state.background)
        case .awaitingValidation:
            return (tr("fee_to_confirm"), state.tint, state.background)
        case .pending:
            return (tr("fee_to_pay"), state.tint, state.background)
        case .late:
            return (tr("fee_overdue"), state.tint, state.background)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Picker(tr("filter"), selection: $filter) {
                    ForEach(MemberFilter.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.segmented)

                if store.canManageClub {
                    HStack(spacing: 12) {
                        SecondaryButton(title: tr("invite"), symbol: "person.badge.plus") {
                            showsInvite = true
                        }
                        SecondaryButton(title: tr("payment"), symbol: "eurosign.circle") {
                            showsPaymentCall = true
                        }
                        SecondaryButton(title: tr("seasonal_contributions"), symbol: "person.text.rectangle") {
                            showsContributionSeason = true
                        }
                    }
                }

                VStack(spacing: 0) {
                    ForEach(members) { member in
                        NavigationLink(value: ClubRoute.memberProfile(member.id)) {
                            MemberRow(member: member, feeChip: feeChip(for: member))
                        }
                        .buttonStyle(.plain)

                        if member.id != members.last?.id {
                            Divider().overlay(Theme.border).padding(.leading, 58)
                        }
                    }
                }
                .assoCard(padding: 14)

                if members.isEmpty {
                    EmptyStateView.search(text: search)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .refreshable { await store.refresh() }
        .navigationTitle(tr("members"))
        .searchable(text: $search, prompt: tr("search_for_a_member"))
        .sheet(isPresented: $showsInvite) {
            InviteMemberSheet()
        }
        .sheet(isPresented: $showsPaymentCall) {
            NewPaymentCallSheet()
        }
        .sheet(isPresented: $showsContributionSeason) {
            ContributionSeasonSheet()
        }
        .clubDestinations()
    }
}

/// One row of the club directory.
struct MemberRow: View {
    let member: Member
    let feeChip: (text: String, tint: Color, background: Color)

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
                    Image(systemName: member.contributionStatus == "player" ? "checkmark.seal.fill" : "person.crop.circle")
                        .font(.caption2)
                        .foregroundStyle(member.contributionStatus == "player" ? Theme.orange : Theme.inkSecondary)
                    Text(member.contributionStatus == "player"
                        ? (member.licenceNumber.isEmpty
                            ? tr("licensed")
                            : tr("licensed_membersview \(member.licenceNumber)"))
                        : tr("member_contribution"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 4)

            StatusChip(
                text: feeChip.text,
                tint: feeChip.tint,
                background: feeChip.background
            )
        }
        .padding(.vertical, 9)
    }
}

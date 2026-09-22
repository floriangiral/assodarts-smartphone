import SwiftUI

/// Profile of another member. Bureau and admin see the administration block:
/// licence, role and payment history, with reminder and deactivation actions.
struct MemberProfileView: View {
    let memberId: UUID

    @Environment(AppStore.self) private var store

    @State private var licenceDraft: String = ""
    @State private var roleDraft: Role = .membre
    @State private var didLoad: Bool = false
    @State private var showsDeactivateAlert: Bool = false
    @State private var reminderSent: Bool = false
    @State private var licenceWasSaved: Bool = false
    @State private var roleWasSaved: Bool = false
    @State private var roleSaveError: String?
    @State private var isSavingRole: Bool = false
    @State private var openedConversationId: UUID?
    @FocusState private var isEditingLicence: Bool

    private var member: Member? { store.member(memberId) }
    private var canManage: Bool { store.canManageClub }
    private var canManageRoles: Bool { store.currentUser?.role.canManageRoles ?? false }

    private var payments: [(call: PaymentCall, item: PaymentItem)] {
        store.payments(for: memberId)
    }

    private var unpaid: [(call: PaymentCall, item: PaymentItem)] {
        payments.filter { !$0.item.isPaid }
    }

    var body: some View {
        ScrollView {
            if let member {
                VStack(spacing: 16) {
                    identityCard(member)

                    if canManage, member.contributionStatus == "player" {
                        licenceSection(member)
                        roleSection(member)
                    } else if canManage {
                        memberStatusSection(member)
                        roleSection(member)
                    } else {
                        readOnlyLicence(member)
                    }

                    historySection

                    if canManage {
                        actions(member)
                    } else {
                        messageButton(member)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }
        }
        .assoCanvas()
        .navigationTitle(tr("member_record"))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $openedConversationId) { id in
            ConversationView(conversationId: id)
                .toolbar(.hidden, for: .tabBar)
        }
        .onAppear(perform: load)
        .keyboardDoneBar(isVisible: isEditingLicence) { isEditingLicence = false }
        .alert(tr("deactivate_this_account"), isPresented: $showsDeactivateAlert) {
            Button(tr("cancel"), role: .cancel) {}
            Button(tr("deactivate"), role: .destructive) {
                guard var member else { return }
                member.isActive = false
                store.updateMember(member)
            }
        } message: {
            Text(tr("the_member_will_lose_access_to_the_app_their_data_stays_"))
        }
    }

    // MARK: - Sections

    private func identityCard(_ member: Member) -> some View {
        VStack(spacing: 14) {
            AvatarView(initials: member.initials, photoData: member.photoData, size: 84)

            VStack(spacing: 4) {
                Text(member.fullName)
                    .font(.title3.bold())
                    .foregroundStyle(Theme.ink)
                Text(tr("member_since \(store.club(member.clubId)?.name ?? "") \(Fmt.shortDate(member.joinedAt))"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 8) {
                RoleBadge(role: member.role)
                let chip = feeChip(for: member)
                StatusChip(text: chip.text, tint: chip.tint, background: chip.background)
                if !member.isActive {
                    StatusChip(text: tr("deactivated"), tint: Theme.red, background: Theme.redTint)
                }
            }

            if !member.email.isEmpty || !member.phone.isEmpty {
                Divider().overlay(Theme.border)
                VStack(alignment: .leading, spacing: 6) {
                    if !member.email.isEmpty {
                        Label(member.email, systemImage: "envelope")
                    }
                    if !member.phone.isEmpty {
                        Label(member.phone, systemImage: "phone")
                    }
                }
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .assoCard(padding: 20)
    }

    private func readOnlyLicence(_ member: Member) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel(text: tr("licence"))
            Text(member.licenceLabel)
                .font(.headline)
                .foregroundStyle(Theme.ink)
            if member.isLicensed, !member.licenceNumber.isEmpty {
                Text(member.licenceNumber)
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .assoCard()
    }

    private func memberStatusSection(_ member: Member) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel(text: tr("seasonal_status"))
            Text(member.contributionStatus == "member" ? tr("member_contribution") : tr("no_contribution_status"))
                .font(.headline)
                .foregroundStyle(Theme.ink)
        }
        .assoCard()
    }

    private func licenceSection(_ member: Member) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("licence"))

            HStack {
                Text(tr("status"))
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
                Spacer()
                StatusChip(
                    text: normalizedLicenceDraft.isEmpty ? tr("without_license") : tr("licensed"),
                    tint: normalizedLicenceDraft.isEmpty ? Theme.inkSecondary : Theme.green,
                    background: normalizedLicenceDraft.isEmpty ? Theme.canvas : Theme.greenTint
                )
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(tr("licence_number"))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
                TextField("07 84 000 000", text: $licenceDraft)
                    .keyboardField(.licence, submit: .done)
                    .focused($isEditingLicence)
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                    .assoFieldSurface(radius: Theme.compactRadius, padding: 12, minHeight: 48)
                    .onSubmit(saveLicence)
                    .onChange(of: licenceDraft) { _, _ in
                        licenceWasSaved = false
                    }
            }

            if licenceHasChanges(comparedTo: member) {
                PrimaryButton(
                    title: tr("save_number"),
                    symbol: "checkmark",
                    action: saveLicence
                )
            } else if licenceWasSaved {
                Label(tr("licence_saved"), systemImage: "checkmark.circle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.green)
            }

            if member.isLicensed || !normalizedLicenceDraft.isEmpty {
                Button(role: .destructive) {
                    licenceDraft = ""
                    saveLicence()
                } label: {
                    Label(tr("remove_licence"), systemImage: "xmark.circle")
                        .font(.footnote.weight(.semibold))
                }
            }

            Label(
                tr("editable_by_the_committee_only"),
                systemImage: "lock.fill"
            )
                .font(.caption)
                .foregroundStyle(Theme.orange)
        }
        .assoCard()
    }

    private var normalizedLicenceDraft: String {
        licenceDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func licenceHasChanges(comparedTo member: Member) -> Bool {
        normalizedLicenceDraft != member.licenceNumber.trimmingCharacters(in: .whitespacesAndNewlines)
            || (normalizedLicenceDraft.isEmpty && member.isLicensed)
            || (!normalizedLicenceDraft.isEmpty && !member.isLicensed)
    }

    private func saveLicence() {
        guard var member, licenceHasChanges(comparedTo: member) else {
            isEditingLicence = false
            return
        }
        let normalized = normalizedLicenceDraft
        member.licenceNumber = normalized
        member.isLicensed = !normalized.isEmpty
        licenceDraft = normalized
        store.updateMember(member)
        isEditingLicence = false
        withAnimation {
            licenceWasSaved = true
        }
    }

    private func roleSection(_ member: Member) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("role_and_permissions"))

            if canManageRoles {
                Picker(tr("role"), selection: $roleDraft) {
                    ForEach(Role.clubRoles) { role in
                        Text(role.label).tag(role)
                    }
                }
                .pickerStyle(.segmented)

                if roleDraft != member.role {
                    PrimaryButton(
                        title: isSavingRole ? tr("saving") : tr("save_role"),
                        symbol: "checkmark",
                        isEnabled: !isSavingRole,
                        action: saveRole
                    )
                } else if roleWasSaved {
                    Label(tr("role_saved"), systemImage: "checkmark.circle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.green)
                }
                    if let roleSaveError {
                        Label(roleSaveError, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(Theme.red)
                    }
            } else {
                HStack {
                    Text(tr("role"))
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    RoleBadge(role: member.role)
                }
            }

            Text(roleDraft.permissionSummary)
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)

            if !canManageRoles {
                Text(tr("only_a_club_admin_can_change_roles"))
                    .font(.caption)
                    .foregroundStyle(Theme.orange)
            }
        }
        .assoCard()
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("payment_history"))

            if payments.isEmpty {
                Text(tr("no_payments_on_record"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }

            ForEach(Array(payments.enumerated()), id: \.element.item.id) { index, entry in
                VStack(spacing: 0) {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(entry.call.label)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.ink)
                            Text(subtitle(for: entry))
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        Spacer(minLength: 4)
                        VStack(alignment: .trailing, spacing: 5) {
                            Text(Fmt.money(entry.call.amountCents))
                                .font(.subheadline.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(Theme.ink)
                            StatusChip(state: entry.item.state(dueDate: entry.call.dueDate))
                        }
                    }
                    .padding(.vertical, 9)

                    if index != payments.count - 1 {
                        Divider().overlay(Theme.border)
                    }
                }
            }
        }
        .assoCard()
    }

    private func actions(_ member: Member) -> some View {
        VStack(spacing: 12) {
            if !unpaid.isEmpty {
                PrimaryButton(
                    title: reminderSent
                        ? tr("reminder_sent")
                        : tr("remind_memberprofileview \(unpaid.count)"),
                    symbol: reminderSent ? "checkmark" : "bell.badge"
                ) {
                    for entry in unpaid {
                        store.remind(callId: entry.call.id, memberIds: [member.id])
                    }
                    NotificationService.notify(
                        title: tr("reminder_sent"),
                        body: tr("was_reminded_about_payment_s \(member.firstName) \(unpaid.count)")
                    )
                    withAnimation { reminderSent = true }
                }
            }

            SecondaryButton(title: tr("message_this_member"), symbol: "bubble.left") {
                openConversation(with: member)
            }

            if member.isActive, member.id != store.currentUser?.id {
                SecondaryButton(
                    title: tr("deactivate_account"),
                    symbol: "person.slash",
                    tint: Theme.red
                ) {
                    showsDeactivateAlert = true
                }
            } else if !member.isActive {
                SecondaryButton(
                    title: tr("reactivate_account"),
                    symbol: "person.badge.plus",
                    tint: Theme.green
                ) {
                    var updated = member
                    updated.isActive = true
                    store.updateMember(updated)
                }
            }
        }
    }

    private func messageButton(_ member: Member) -> some View {
        SecondaryButton(title: tr("message_this_member"), symbol: "bubble.left") {
            openConversation(with: member)
        }
    }

    // MARK: - Helpers

    private func openConversation(with member: Member) {
        guard let me = store.currentUser else { return }
        guard let conversation = store.directConversation(between: me.id, and: member.id, clubId: me.clubId) else { return }
        openedConversationId = conversation.id
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

    private func subtitle(for entry: (call: PaymentCall, item: PaymentItem)) -> String {
        if entry.item.isPaid, let paidAt = entry.item.paidAt {
            return tr("paid_on_memberprofileview \(Fmt.shortDate(paidAt))")
        }
        if let reminded = entry.item.remindedAt {
            return tr("due_reminded_on \(Fmt.shortDate(entry.call.dueDate)) \(Fmt.shortDate(reminded))")
        }
        return tr("due_memberprofileview \(Fmt.shortDate(entry.call.dueDate))")
    }

    private func load() {
        guard !didLoad, let member else { return }
        licenceDraft = member.licenceNumber
        roleDraft = member.role
        didLoad = true
    }

    private func saveRole() {
        guard var member, roleDraft != member.role else { return }
        member.role = roleDraft
        roleWasSaved = false
        roleSaveError = nil
        isSavingRole = true
        store.updateMember(
            member,
            onSuccess: { @MainActor in
                isSavingRole = false
                withAnimation { roleWasSaved = true }
            },
            onFailure: { @MainActor message in
                isSavingRole = false
                roleSaveError = message
            }
        )
    }
}

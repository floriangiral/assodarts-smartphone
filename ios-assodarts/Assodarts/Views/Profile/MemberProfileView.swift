import SwiftUI

/// Profile of another member. Bureau and admin see the administration block:
/// licence, role and payment history, with reminder and deactivation actions.
struct MemberProfileView: View {
    let memberId: UUID

    @Environment(AppStore.self) private var store

    @State private var licenceDraft: String = ""
    @State private var isLicensedDraft: Bool = false
    @State private var roleDraft: Role = .membre
    @State private var didLoad: Bool = false
    @State private var showsDeactivateAlert: Bool = false
    @State private var reminderSent: Bool = false
    @State private var openedConversationId: UUID?

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

                    if canManage {
                        licenceSection(member)
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
        .navigationTitle("Fiche membre")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $openedConversationId) { id in
            ConversationView(conversationId: id)
                .toolbar(.hidden, for: .tabBar)
        }
        .onAppear(perform: load)
        .alert("Désactiver ce compte ?", isPresented: $showsDeactivateAlert) {
            Button("Annuler", role: .cancel) {}
            Button("Désactiver", role: .destructive) {
                guard var member else { return }
                member.isActive = false
                store.updateMember(member)
            }
        } message: {
            Text("Le membre n'aura plus accès à l'application. Ses données restent conservées par le club.")
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
                Text("\(store.club(member.clubId)?.name ?? "") · membre depuis \(Fmt.shortDate(member.joinedAt))")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 8) {
                RoleBadge(role: member.role)
                StatusChip(state: store.membershipState(for: member.id))
                if !member.isActive {
                    StatusChip(text: "Désactivé", tint: Theme.red, background: Theme.redTint)
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
            SectionLabel(text: "Licence")
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

    private func licenceSection(_ member: Member) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: "Licence")

            Picker("Statut", selection: $isLicensedDraft) {
                Text("Licencié").tag(true)
                Text("Membre simple").tag(false)
            }
            .pickerStyle(.segmented)
            .onChange(of: isLicensedDraft) { _, newValue in
                guard var updated = self.member else { return }
                updated.isLicensed = newValue
                if !newValue { updated.licenceNumber = "" ; licenceDraft = "" }
                store.updateMember(updated)
            }

            if isLicensedDraft {
                VStack(alignment: .leading, spacing: 6) {
                    Text("N° de licence")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                    TextField("07 84 000 000", text: $licenceDraft)
                        .keyboardType(.numbersAndPunctuation)
                        .monospacedDigit()
                        .padding(12)
                        .background(Theme.canvas, in: .rect(cornerRadius: 10))
                        .onSubmit(saveLicence)
                    Button("Enregistrer le numéro", action: saveLicence)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.navy)
                }
                Label("Modifiable par le bureau uniquement", systemImage: "lock.fill")
                    .font(.caption)
                    .foregroundStyle(Theme.orange)
            }
        }
        .assoCard()
    }

    private func roleSection(_ member: Member) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: "Rôle et droits")

            if canManageRoles {
                Picker("Rôle", selection: $roleDraft) {
                    ForEach(Role.clubRoles) { role in
                        Text(role.label).tag(role)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: roleDraft) { _, newValue in
                    guard var updated = self.member else { return }
                    updated.role = newValue
                    store.updateMember(updated)
                }
            } else {
                HStack {
                    Text("Rôle")
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
                Text("Seul un admin du club peut modifier les rôles.")
                    .font(.caption)
                    .foregroundStyle(Theme.orange)
            }
        }
        .assoCard()
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: "Historique des paiements")

            if payments.isEmpty {
                Text("Aucun paiement enregistré.")
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
                    title: reminderSent ? "Relance envoyée" : "Relancer (\(unpaid.count))",
                    symbol: reminderSent ? "checkmark" : "bell.badge"
                ) {
                    for entry in unpaid {
                        store.remind(callId: entry.call.id, memberIds: [member.id])
                    }
                    NotificationService.notify(
                        title: "Relance envoyée",
                        body: "\(member.firstName) a été relancé pour \(unpaid.count) paiement(s)."
                    )
                    withAnimation { reminderSent = true }
                }
            }

            SecondaryButton(title: "Écrire à ce membre", symbol: "bubble.left") {
                openConversation(with: member)
            }

            if member.isActive, member.id != store.currentUser?.id {
                SecondaryButton(title: "Désactiver le compte", symbol: "person.slash", tint: Theme.red) {
                    showsDeactivateAlert = true
                }
            } else if !member.isActive {
                SecondaryButton(title: "Réactiver le compte", symbol: "person.badge.plus", tint: Theme.green) {
                    var updated = member
                    updated.isActive = true
                    store.updateMember(updated)
                }
            }
        }
    }

    private func messageButton(_ member: Member) -> some View {
        SecondaryButton(title: "Écrire à ce membre", symbol: "bubble.left") {
            openConversation(with: member)
        }
    }

    // MARK: - Helpers

    private func openConversation(with member: Member) {
        guard let me = store.currentUser else { return }
        let conversation = store.directConversation(between: me.id, and: member.id, clubId: member.clubId)
        openedConversationId = conversation.id
    }

    private func subtitle(for entry: (call: PaymentCall, item: PaymentItem)) -> String {
        if entry.item.isPaid, let paidAt = entry.item.paidAt {
            return "Payé le \(Fmt.shortDate(paidAt))"
        }
        if let reminded = entry.item.remindedAt {
            return "Échéance \(Fmt.shortDate(entry.call.dueDate)) · relancé le \(Fmt.shortDate(reminded))"
        }
        return "Échéance \(Fmt.shortDate(entry.call.dueDate))"
    }

    private func load() {
        guard !didLoad, let member else { return }
        licenceDraft = member.licenceNumber
        isLicensedDraft = member.isLicensed
        roleDraft = member.role
        didLoad = true
    }

    private func saveLicence() {
        guard var member else { return }
        member.licenceNumber = licenceDraft.trimmingCharacters(in: .whitespaces)
        member.isLicensed = true
        store.updateMember(member)
    }
}

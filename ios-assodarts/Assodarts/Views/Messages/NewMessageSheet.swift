import SwiftUI

/// Start a private conversation: a member writes to the bureau (or to one of
/// its members); the bureau writes to any member of the club.
struct NewMessageSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var target: Target = .bureau
    @State private var selectedId: UUID?
    @State private var search: String = ""
    @State private var draft: String = ""
    @FocusState private var isEditing: Bool

    enum Target: String, CaseIterable, Identifiable {
        case bureau
        case person

        var id: String { rawValue }
    }

    private var isBureauUser: Bool { store.currentUser?.role.canManageClub ?? false }

    private var candidates: [Member] {
        guard let user = store.currentUser else { return [] }
        let pool = isBureauUser
            ? store.members(of: user.clubId).filter { $0.id != user.id }
            : store.bureauMembers(of: user.clubId).filter { $0.id != user.id }
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return pool }
        return pool.filter { $0.fullName.localizedStandardContains(query) }
    }

    private var canSend: Bool {
        guard !draft.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        if isBureauUser || target == .person { return selectedId != nil }
        return true
    }

    var body: some View {
        NavigationStack {
            Form {
                if !isBureauUser {
                    Section {
                        Picker(tr("Destinataire", "Recipient"), selection: $target) {
                            Text(tr("Le Bureau", "The Committee")).tag(Target.bureau)
                            Text(tr("Un membre du bureau", "One committee member")).tag(Target.person)
                        }
                        .pickerStyle(.segmented)
                    } header: {
                        Text(tr("Destinataire", "Recipient"))
                    } footer: {
                        Text(target == .bureau
                             ? tr(
                                "Votre message sera visible par tous les membres du bureau.",
                                "Your message will be visible to every committee member."
                             )
                             : tr(
                                "Votre message restera privé entre vous et cette personne.",
                                "Your message stays private between you and this person."
                             ))
                    }
                }

                if isBureauUser || target == .person {
                    Section(isBureauUser
                        ? tr("Membre du club", "Club member")
                        : tr("Membre du bureau", "Committee member")) {
                        TextField(tr("Rechercher…", "Search…"), text: $search)
                            .keyboardField(.name, submit: .search)
                            .focused($isEditing)
                            .foregroundStyle(Theme.ink)

                        ForEach(candidates) { member in
                            Button {
                                selectedId = selectedId == member.id ? nil : member.id
                            } label: {
                                HStack(spacing: 12) {
                                    AvatarView(
                                        initials: member.initials,
                                        photoData: member.photoData,
                                        size: 34
                                    )
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(member.fullName)
                                            .font(.subheadline.weight(.medium))
                                            .foregroundStyle(Theme.ink)
                                        Text(member.role.label)
                                            .font(.caption)
                                            .foregroundStyle(Theme.inkSecondary)
                                    }
                                    Spacer()
                                    Image(systemName: selectedId == member.id ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(
                                            selectedId == member.id
                                                ? Theme.navy
                                                : Theme.inkSecondary.opacity(0.4)
                                        )
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section {
                    TextField(tr("Votre message…", "Your message…"), text: $draft, axis: .vertical)
                        .lineLimit(4...10)
                        .keyboardField(.freeText, submit: .return)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                } header: {
                    Text(tr("Votre message", "Your message"))
                } footer: {
                    Text(tr(
                        "Le destinataire recevra une notification.",
                        "The recipient will get a notification."
                    ))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditing) { isEditing = false }
            .navigationTitle(tr("Nouveau message", "New message"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("Annuler", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("Envoyer", "Send"), action: send)
                        .fontWeight(.semibold)
                        .disabled(!canSend)
                }
            }
        }
    }

    private func send() {
        guard let user = store.currentUser else { return }
        let conversation: Conversation
        if !isBureauUser, target == .bureau {
            conversation = store.bureauChannel(for: user.id, clubId: user.clubId)
        } else if let selectedId {
            conversation = store.directConversation(between: user.id, and: selectedId, clubId: user.clubId)
        } else {
            return
        }
        store.send(text: draft, in: conversation.id, from: user.id)
        NotificationService.notify(
            title: tr("Message envoyé", "Message sent"),
            body: tr("Votre message a bien été transmis.", "Your message has been delivered.")
        )
        dismiss()
    }
}

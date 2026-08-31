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
                        Picker("Destinataire", selection: $target) {
                            Text("Le Bureau").tag(Target.bureau)
                            Text("Un membre du bureau").tag(Target.person)
                        }
                        .pickerStyle(.segmented)
                    } header: {
                        Text("Destinataire")
                    } footer: {
                        Text(target == .bureau
                             ? "Votre message sera visible par tous les membres du bureau."
                             : "Votre message restera privé entre vous et cette personne.")
                    }
                }

                if isBureauUser || target == .person {
                    Section(isBureauUser ? "Membre du club" : "Membre du bureau") {
                        TextField("Rechercher…", text: $search)

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
                    TextField("Votre message…", text: $draft, axis: .vertical)
                        .lineLimit(4...10)
                } header: {
                    Text("Votre message")
                } footer: {
                    Text("Le destinataire recevra une notification.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .navigationTitle("Nouveau message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Envoyer", action: send)
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
            title: "Message envoyé",
            body: "Votre message a bien été transmis."
        )
        dismiss()
    }
}

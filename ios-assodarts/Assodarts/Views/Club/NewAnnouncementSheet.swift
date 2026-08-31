import SwiftUI

/// Bureau composer for a club announcement.
struct NewAnnouncementSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""
    @State private var body_: String = ""
    @State private var isPinned: Bool = false
    @State private var notify: Bool = true

    private var canPublish: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !body_.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Annonce") {
                    TextField("Titre de l'annonce", text: $title)
                    TextField("Votre message…", text: $body_, axis: .vertical)
                        .lineLimit(5...10)
                }

                Section {
                    Toggle("Épingler en haut du fil", isOn: $isPinned)
                    Toggle("Notifier les membres", isOn: $notify)
                } footer: {
                    Text("Les membres ayant activé les notifications d'annonces recevront une alerte.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .navigationTitle("Nouvelle annonce")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Publier", action: publish)
                        .disabled(!canPublish)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private func publish() {
        guard let user = store.currentUser else { return }
        store.publishAnnouncement(title: title, body: body_, pinned: isPinned, author: user)
        if notify {
            NotificationService.notify(
                title: store.currentClub?.name ?? "Votre club",
                body: title.trimmingCharacters(in: .whitespaces)
            )
        }
        dismiss()
    }
}

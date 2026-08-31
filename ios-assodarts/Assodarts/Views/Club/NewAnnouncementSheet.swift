import SwiftUI

/// Bureau composer for a club announcement.
struct NewAnnouncementSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""
    @State private var body_: String = ""
    @State private var isPinned: Bool = false
    @State private var notify: Bool = true
    @FocusState private var isEditing: Bool

    private var canPublish: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !body_.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("Annonce", "Announcement")) {
                    TextField(tr("Titre de l'annonce", "Announcement title"), text: $title)
                        .keyboardField(.freeText, submit: .next)
                        .focused($isEditing)
                    TextField(tr("Votre message…", "Your message…"), text: $body_, axis: .vertical)
                        .lineLimit(5...10)
                        .keyboardField(.freeText, submit: .return)
                        .focused($isEditing)
                }

                Section {
                    Toggle(tr("Épingler en haut du fil", "Pin to the top of the feed"), isOn: $isPinned)
                    Toggle(tr("Notifier les membres", "Notify members"), isOn: $notify)
                } footer: {
                    Text(tr(
                        "Les membres ayant activé les notifications d'annonces recevront une alerte.",
                        "Members who enabled announcement notifications will get an alert."
                    ))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditing) { isEditing = false }
            .navigationTitle(tr("Nouvelle annonce", "New announcement"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("Annuler", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("Publier", "Publish"), action: publish)
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
                title: store.currentClub?.name ?? tr("Votre club", "Your club"),
                body: title.trimmingCharacters(in: .whitespaces)
            )
        }
        dismiss()
    }
}

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
                Section(tr("announcement")) {
                    TextField(tr("announcement_title"), text: $title)
                        .keyboardField(.freeText, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                    TextField(tr("your_message"), text: $body_, axis: .vertical)
                        .lineLimit(5...10)
                        .keyboardField(.freeText, submit: .return)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                }

                Section {
                    Toggle(tr("pin_to_the_top_of_the_feed"), isOn: $isPinned)
                    Toggle(tr("notify_members"), isOn: $notify)
                } footer: {
                    Text(tr("members_who_enabled_announcement_notifications_will_get_"))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditing) { isEditing = false }
            .navigationTitle(tr("new_announcement"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("publish"), action: publish)
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
                title: store.currentClub?.name ?? tr("your_club"),
                body: title.trimmingCharacters(in: .whitespaces)
            )
        }
        dismiss()
    }
}

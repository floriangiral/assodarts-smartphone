import SwiftUI

/// Broadcast a message to every user of the platform, or only to the admins and
/// bureaux of the clubs.
struct DevBroadcastView: View {
    @Environment(AppStore.self) private var store

    @State private var title: String = ""
    @State private var message: String = ""
    @State private var audience: BroadcastAudience = .admins
    @State private var didPublish: Bool = false
    @FocusState private var isEditing: Bool

    private var canPublish: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !message.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var recipients: Int {
        audience == .all ? store.totalMembers : store.broadcastRecipients
    }

    var body: some View {
        ScrollView {
                    ForEach(store.platformAnnouncements) { announcement in
                    await store.broadcast(title: title, body: message, audience: audience)
                    NotificationService.notify(title: "Assodarts", body: title)
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        didPublish = true
                        title = ""
                        message = ""
                    }
                        publishedRow(announcement)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .keyboardDismissable()
        .keyboardDoneBar(isVisible: isEditing) { isEditing = false }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField(tr("broadcast_title"), text: $title)
                .font(.headline)
                .keyboardField(.freeText, submit: .next)
                .focused($isEditing)
                .foregroundStyle(Theme.ink)
                .padding(12)
                .background(Theme.canvas, in: .rect(cornerRadius: Theme.compactRadius))

            TextField(tr("your_message"), text: $message, axis: .vertical)
                .lineLimit(4...8)
                .keyboardField(.freeText, submit: .return)
                .focused($isEditing)
                .foregroundStyle(Theme.ink)
                .padding(12)
                .background(Theme.canvas, in: .rect(cornerRadius: Theme.compactRadius))

            Picker(tr("audience"), selection: $audience) {
                ForEach(BroadcastAudience.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            Text(tr("clubs_recipients \(store.totalClubs) \(Fmt.number(recipients))"))
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
                        Task {
                            await store.broadcast(title: title, body: message, audience: audience)
                            NotificationService.notify(title: "Assodarts", body: title)
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                didPublish = true
                                title = ""
                                message = ""
                            }
                        }
            ) {
                store.broadcast(title: title, body: message, audience: audience)
                NotificationService.notify(title: "Assodarts", body: title)
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    didPublish = true
                    title = ""
                    message = ""
                }
                Task {
                    try? await Task.sleep(for: .seconds(2))
                    didPublish = false
                }
            }
        }
        .assoCard(padding: 18)
    }

    private func publishedRow(_ announcement: PlatformAnnouncement) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(announcement.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Spacer()
                Text(Fmt.shortDate(announcement.publishedAt))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            Text(announcement.body)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
                .lineLimit(2)

            StatusChip(
                text: announcement.audience.label,
                tint: announcement.audience == .all ? Theme.navy : Theme.orange,
                background: announcement.audience == .all ? Theme.navyTint : Theme.orangeTint
            )
        }
        .assoCard()
    }
}

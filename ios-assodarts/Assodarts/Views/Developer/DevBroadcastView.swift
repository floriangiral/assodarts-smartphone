import SwiftUI

/// Broadcast a message to every user of the platform, or only to the admins and
/// bureaux of the clubs.
struct DevBroadcastView: View {
    @Environment(AppStore.self) private var store

    @State private var title: String = ""
    @State private var message: String = ""
    @State private var audience: BroadcastAudience = .admins
    @State private var didPublish: Bool = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case title
        case message
    }

    private var canPublish: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !message.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var recipients: Int {
        audience == .all ? store.totalMembers : store.broadcastRecipients
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                DevHeaderBand(title: tr("broadcasts"))
                composer

                if didPublish {
                    Label(tr("broadcast_published"), systemImage: "checkmark.circle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.green)
                }

                ForEach(store.platformAnnouncements) { announcement in
                    publishedRow(announcement)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .keyboardDismissable()
        .keyboardDoneBar(isVisible: focusedField != nil) { focusedField = nil }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField(tr("broadcast_title"), text: $title)
                .font(.headline)
                .keyboardField(.freeText, submit: .next)
                .focused($focusedField, equals: .title)
                .onSubmit { focusedField = .message }
                .foregroundStyle(Theme.ink)
                .assoFieldSurface(radius: Theme.compactRadius, padding: 12, minHeight: 48)

            TextField(tr("your_message"), text: $message, axis: .vertical)
                .lineLimit(4...8)
                .keyboardField(.freeText, submit: .return)
                .focused($focusedField, equals: .message)
                .onSubmit { focusedField = nil }
                .foregroundStyle(Theme.ink)
                .assoFieldSurface(radius: Theme.compactRadius, padding: 12, minHeight: 112)

            Picker(tr("audience"), selection: $audience) {
                ForEach(BroadcastAudience.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            Text(tr("clubs_recipients \(store.totalClubs) \(Fmt.number(recipients))"))
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)

            PrimaryButton(title: tr("publish_broadcast"), symbol: "paperplane", isEnabled: canPublish) {
                let broadcastTitle = title
                let broadcastMessage = message
                Task {
                    await store.broadcast(
                        title: broadcastTitle,
                        body: broadcastMessage,
                        audience: audience
                    )
                    NotificationService.notify(title: "Assodarts", body: broadcastTitle)
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        didPublish = true
                        title = ""
                        message = ""
                    }
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

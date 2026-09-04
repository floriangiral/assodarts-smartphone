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
            VStack(spacing: 18) {
                DevHeaderBand(title: tr("Annonces", "Broadcasts"))

                composer

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(text: tr("Annonces publiées", "Published broadcasts"))
                    ForEach(store.platformAnnouncements) { announcement in
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
            TextField(tr("Titre de l'annonce", "Broadcast title"), text: $title)
                .font(.headline)
                .keyboardField(.freeText, submit: .next)
                .focused($isEditing)
                .foregroundStyle(Theme.ink)
                .padding(12)
                .background(Theme.canvas, in: .rect(cornerRadius: 10))

            TextField(tr("Votre message…", "Your message…"), text: $message, axis: .vertical)
                .lineLimit(4...8)
                .keyboardField(.freeText, submit: .return)
                .focused($isEditing)
                .foregroundStyle(Theme.ink)
                .padding(12)
                .background(Theme.canvas, in: .rect(cornerRadius: 10))

            Picker(tr("Audience", "Audience"), selection: $audience) {
                ForEach(BroadcastAudience.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            Text(tr(
                "\(store.totalClubs) clubs · \(Fmt.number(recipients)) destinataires",
                "\(store.totalClubs) clubs · \(Fmt.number(recipients)) recipients"
            ))
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)

            PrimaryButton(
                title: didPublish
                    ? tr("Annonce publiée", "Broadcast published")
                    : tr("Publier l'annonce", "Publish broadcast"),
                symbol: didPublish ? "checkmark" : "paperplane.fill",
                isEnabled: canPublish
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

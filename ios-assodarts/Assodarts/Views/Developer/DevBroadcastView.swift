import SwiftUI

/// Broadcast a message to every user of the platform, or only to the admins and
/// bureaux of the clubs.
struct DevBroadcastView: View {
    @Environment(AppStore.self) private var store

    @State private var title: String = ""
    @State private var message: String = ""
    @State private var audience: BroadcastAudience = .admins
    @State private var didPublish: Bool = false

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
                DevHeaderBand(title: "Annonces")

                composer

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(text: "Annonces publiées")
                    ForEach(store.platformAnnouncements) { announcement in
                        publishedRow(announcement)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .toolbar(.hidden, for: .navigationBar)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Titre de l'annonce", text: $title)
                .font(.headline)
                .padding(12)
                .background(Theme.canvas, in: .rect(cornerRadius: 10))

            TextField("Votre message…", text: $message, axis: .vertical)
                .lineLimit(4...8)
                .padding(12)
                .background(Theme.canvas, in: .rect(cornerRadius: 10))

            Picker("Audience", selection: $audience) {
                ForEach(BroadcastAudience.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            Text("\(store.totalClubs) clubs · \(recipients.formatted(.number.locale(Fmt.locale))) destinataires")
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)

            PrimaryButton(
                title: didPublish ? "Annonce publiée" : "Publier l'annonce",
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

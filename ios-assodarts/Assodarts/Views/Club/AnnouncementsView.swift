import SwiftUI

/// Club announcements feed. The bureau can publish from here.
struct AnnouncementsView: View {
    @Environment(AppStore.self) private var store
    @State private var showsComposer: Bool = false

    private var announcements: [Announcement] {
        guard let club = store.currentClub else { return [] }
        return store.announcements(of: club.id)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if let user = store.currentUser,
                   let notice = store.visiblePlatformAnnouncements(for: user).first {
                    PlatformNoticeCard(announcement: notice)
                }

                ForEach(announcements) { announcement in
                    NavigationLink(value: ClubRoute.announcement(announcement.id)) {
                        AnnouncementCard(announcement: announcement)
                    }
                    .buttonStyle(.plain)
                }

                if announcements.isEmpty {
                    ContentUnavailableView(
                        "Aucune annonce",
                        systemImage: "megaphone",
                        description: Text("Les informations du bureau apparaîtront ici.")
                    )
                    .padding(.top, 60)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .navigationTitle("Annonces")
        .toolbar {
            if store.canManageClub {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsComposer = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                    .accessibilityLabel("Nouvelle annonce")
                }
            }
        }
        .sheet(isPresented: $showsComposer) {
            NewAnnouncementSheet()
        }
        .clubDestinations()
    }
}

/// Card representation of one announcement in the feed.
struct AnnouncementCard: View {
    let announcement: Announcement

    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                if announcement.isPinned {
                    Label("Épinglée", systemImage: "pin.fill")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.orange)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Theme.orangeTint, in: .capsule)
                }
                Spacer()
                Text(Fmt.shortDate(announcement.publishedAt))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            Text(announcement.title)
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.leading)

            Text(announcement.body)
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .lineLimit(3)
                .multilineTextAlignment(.leading)

            HStack(spacing: 8) {
                AvatarView(
                    initials: store.member(announcement.authorId)?.initials ?? "??",
                    photoData: store.member(announcement.authorId)?.photoData,
                    size: 26
                )
                Text(store.memberName(announcement.authorId))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.inkSecondary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.6))
            }
        }
        .assoCard()
    }
}

/// Full text of an announcement.
struct AnnouncementDetailView: View {
    let announcementId: UUID

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private var announcement: Announcement? {
        store.db.announcements.first { $0.id == announcementId }
    }

    var body: some View {
        ScrollView {
            if let announcement {
                VStack(alignment: .leading, spacing: 16) {
                    if announcement.isPinned {
                        Label("Annonce épinglée", systemImage: "pin.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.orange)
                    }

                    Text(announcement.title)
                        .font(.title2.bold())
                        .foregroundStyle(Theme.ink)

                    HStack(spacing: 10) {
                        AvatarView(
                            initials: store.member(announcement.authorId)?.initials ?? "??",
                            photoData: store.member(announcement.authorId)?.photoData,
                            size: 34
                        )
                        VStack(alignment: .leading, spacing: 1) {
                            Text(store.memberName(announcement.authorId))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                            Text(Fmt.mediumDate(announcement.publishedAt))
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                    }

                    Divider().overlay(Theme.border)

                    Text(announcement.body)
                        .font(.body)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .assoCard(padding: 20)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }
        }
        .assoCanvas()
        .navigationTitle("Annonce")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if store.canManageClub, let announcement {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Supprimer l'annonce", systemImage: "trash", role: .destructive) {
                            store.deleteAnnouncement(announcement.id)
                            dismiss()
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
    }
}

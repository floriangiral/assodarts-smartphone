import SwiftUI

/// Shared header of the club space: avatar to the profile, greeting, and the
/// private messaging entry point with its unread badge.
struct DashboardHeader: View {
    let user: Member
    let subtitle: String

    @Environment(AppStore.self) private var store

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        return hour < 18 ? tr("Bonjour", "Hello") : tr("Bonsoir", "Good evening")
    }

    var body: some View {
        HStack(spacing: 12) {
            NavigationLink(value: ClubRoute.myProfile) {
                AvatarView(initials: user.initials, photoData: user.photoData, size: 48)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(tr("Mon profil", "My profile"))

            VStack(alignment: .leading, spacing: 2) {
                Text("\(greeting), \(user.firstName)")
                    .font(.title3.bold())
                    .foregroundStyle(Theme.ink)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            NavigationLink(value: ClubRoute.messages) {
                ZStack(alignment: .topTrailing) {
                    Circle()
                        .fill(Theme.surface)
                        .frame(width: 44, height: 44)
                        .overlay { Circle().stroke(Theme.border, lineWidth: 1) }
                        .overlay {
                            Image(systemName: "bubble.left.and.bubble.right.fill")
                                .font(.subheadline)
                                .foregroundStyle(Theme.navy)
                        }

                    let unread = store.unreadCount(for: user)
                    if unread > 0 {
                        Text("\(unread)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(minWidth: 20, minHeight: 20)
                            .background(Theme.orange, in: .circle)
                            .offset(x: 4, y: -4)
                            .transition(.scale)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(tr("Messages", "Messages"))
        }
    }
}

import SwiftUI

/// Shared header of the club space: avatar to the profile, greeting, and the
/// private messaging entry point with its unread badge.
struct DashboardHeader: View {
    let user: Member
    let subtitle: String

    @Environment(AppStore.self) private var store
    @State private var clubSwitchError: String?

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
                if store.availableClubs.count > 1 {
                    clubSwitcher
                } else {
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 8)

            NavigationLink(value: ClubRoute.notifications) {
                iconButton(
                    symbol: "bell.fill",
                    badge: store.unreadNotificationCount
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(tr("Notifications", "Notifications"))

            NavigationLink(value: ClubRoute.messages) {
                iconButton(
                    symbol: "bubble.left.and.bubble.right.fill",
                    badge: store.unreadCount(for: user)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(tr("Messages", "Messages"))
        }
        .alert(
            tr("Changement de club impossible", "Couldn't switch club"),
            isPresented: Binding(get: { clubSwitchError != nil }, set: { if !$0 { clubSwitchError = nil } })
        ) {
            Button(tr("OK", "OK"), role: .cancel) {}
        } message: {
            Text(clubSwitchError ?? "")
        }
    }

    /// Lets a member who belongs to several clubs switch the active one, right from the header.
    private var clubSwitcher: some View {
        Menu {
            ForEach(store.availableClubs) { club in
                Button {
                    guard club.id != store.activeClubRemoteId else { return }
                    Task {
                        if let message = await store.switchActiveClub(to: club.id) {
                            clubSwitchError = message
                        }
                    }
                } label: {
                    if club.id == store.activeClubRemoteId {
                        Label(club.name, systemImage: "checkmark")
                    } else {
                        Text(club.name)
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .lineLimit(1)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .disabled(store.isSyncing)
        .accessibilityLabel(tr("Changer de club actif", "Switch active club"))
    }

    /// Round toolbar button with an optional unread count.
    private func iconButton(symbol: String, badge: Int) -> some View {
        ZStack(alignment: .topTrailing) {
            Circle()
                .fill(Theme.surface)
                .frame(width: 44, height: 44)
                .overlay { Circle().stroke(Theme.border, lineWidth: 1) }
                .overlay {
                    Image(systemName: symbol)
                        .font(.subheadline)
                        .foregroundStyle(Theme.navy)
                }

            if badge > 0 {
                Text(badge > 99 ? "99+" : "\(badge)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, badge > 9 ? 5 : 0)
                    .frame(minWidth: 20, minHeight: 20)
                    .background(Theme.orange, in: .capsule)
                    .offset(x: 4, y: -4)
                    .transition(.scale)
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: badge)
    }
}

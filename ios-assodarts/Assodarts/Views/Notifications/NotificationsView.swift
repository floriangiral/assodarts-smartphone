import SwiftUI

/// The member's notification inbox: announcements, payment requests, and the
/// bureau's validation queue, all filled server-side.
struct NotificationsView: View {
    @Environment(AppStore.self) private var store

    private var items: [AppNotification] { store.notifications }

    var body: some View {
        Group {
            if items.isEmpty {
                emptyState
            } else {
                list
            }
        }
        .assoCanvas()
        .navigationTitle(tr("Notifications", "Notifications"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if store.unreadNotificationCount > 0 {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(tr("Tout lire", "Read all")) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            store.markAllNotificationsRead()
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                }
            }
        }
        .refreshable { await store.loadNotifications() }
        .task { await store.loadNotifications() }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(items) { item in
                    row(item)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
        }
    }

    @ViewBuilder
    private func row(_ item: AppNotification) -> some View {
        let card = NotificationRow(item: item)

        if let route = item.route {
            NavigationLink(value: route) {
                card
            }
            .buttonStyle(.plain)
            .simultaneousGesture(TapGesture().onEnded {
                store.markNotificationRead(item.id)
            })
            .swipeActionsCompat { store.deleteNotification(item.id) }
        } else {
            Button {
                store.markNotificationRead(item.id)
            } label: {
                card
            }
            .buttonStyle(.plain)
            .swipeActionsCompat { store.deleteNotification(item.id) }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "bell.slash")
                .font(.system(size: 44))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            Text(tr("Aucune notification", "No notifications"))
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Text(store.mode == .demo
                 ? tr(
                    "Les notifications arrivent une fois connecté au serveur de votre club.",
                    "Notifications arrive once you are connected to your club's server."
                 )
                 : tr(
                    "Annonces, appels à paiement et validations s'afficheront ici.",
                    "Announcements, payment requests and confirmations will show up here."
                 ))
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.inkSecondary)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// A single inbox row.
private struct NotificationRow: View {
    let item: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.kind.symbol)
                .font(.subheadline)
                .foregroundStyle(item.kind.tint)
                .frame(width: 40, height: 40)
                .background(item.kind.background, in: .circle)

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(item.localizedTitle)
                        .font(.subheadline.weight(item.isUnread ? .bold : .semibold))
                        .foregroundStyle(Theme.ink)
                    if item.isUnread {
                        Circle()
                            .fill(Theme.orange)
                            .frame(width: 7, height: 7)
                    }
                    Spacer(minLength: 4)
                    Text(Fmt.shortDate(item.createdAt))
                        .font(.caption2)
                        .foregroundStyle(Theme.inkSecondary)
                }

                Text(item.localizedBody)
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(item.isUnread ? Theme.navyTint.opacity(0.45) : Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.cardRadius))
        .overlay {
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.border, lineWidth: 1)
        }
    }
}

private extension View {
    /// Swipe-to-delete that works on a plain card outside a `List`.
    func swipeActionsCompat(onDelete: @escaping () -> Void) -> some View {
        contextMenu {
            Button(role: .destructive, action: onDelete) {
                Label(tr("Supprimer", "Delete"), systemImage: "trash")
            }
        }
    }
}

#Preview {
    NavigationStack {
        NotificationsView()
    }
    .environment(AppStore())
    .environment(Localization.shared)
}

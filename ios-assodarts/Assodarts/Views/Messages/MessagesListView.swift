import SwiftUI

/// Private messaging home: the member's conversations, or the bureau inbox.
struct MessagesListView: View {
    @Environment(AppStore.self) private var store

    @State private var search: String = ""
    @State private var showsComposer: Bool = false

    private var conversations: [Conversation] {
        guard let user = store.currentUser else { return [] }
        let all = store.conversations(for: user)
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return all }
        return all.filter { conversation in
            store.conversationTitle(conversation, viewer: user).localizedStandardContains(query)
                || (conversation.lastMessage?.text.localizedStandardContains(query) ?? false)
        }
    }

    var body: some View {
        Group {
            if let user = store.currentUser {
                ScrollView {
                    VStack(spacing: 12) {
                        if conversations.isEmpty {
                            ContentUnavailableView(
                                "Aucune conversation",
                                systemImage: "bubble.left.and.bubble.right",
                                description: Text(user.role.canManageClub
                                    ? "Les messages des membres arriveront ici."
                                    : "Écrivez au bureau de votre club en un tap.")
                            )
                            .padding(.top, 80)
                        }

                        ForEach(pinnedFirst(conversations, viewer: user)) { conversation in
                            NavigationLink(value: ClubRoute.conversation(conversation.id)) {
                                ConversationRow(conversation: conversation, viewer: user)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                }
                .assoCanvas()
                .safeAreaInset(edge: .bottom) {
                    HStack {
                        Spacer()
                        Button {
                            showsComposer = true
                        } label: {
                            VStack(spacing: 6) {
                                Image(systemName: "square.and.pencil")
                                    .font(.title3.weight(.semibold))
                                    .foregroundStyle(.white)
                                    .frame(width: 60, height: 60)
                                    .background(Theme.navy, in: .circle)
                                    .shadow(color: Theme.navy.opacity(0.3), radius: 12, y: 6)
                                Text("Nouveau message")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.ink)
                            }
                        }
                        .buttonStyle(PressableButtonStyle())
                    }
                    .padding(.trailing, 24)
                    .padding(.bottom, 8)
                }
            }
        }
        .navigationTitle("Messages")
        .searchable(text: $search, prompt: "Rechercher une conversation")
        .sheet(isPresented: $showsComposer) {
            NewMessageSheet()
        }
    }

    private func pinnedFirst(_ list: [Conversation], viewer: Member) -> [Conversation] {
        guard !viewer.role.canManageClub else { return list }
        return list.sorted { lhs, rhs in
            if (lhs.kind == .bureau) != (rhs.kind == .bureau) { return lhs.kind == .bureau }
            return lhs.updatedAt > rhs.updatedAt
        }
    }
}

/// One conversation row with avatar, excerpt and unread badge.
struct ConversationRow: View {
    let conversation: Conversation
    let viewer: Member

    @Environment(AppStore.self) private var store

    private var isOfficialChannel: Bool {
        conversation.kind == .bureau && !viewer.role.canManageClub
    }

    var body: some View {
        let unread = conversation.unreadCount(for: viewer.id)

        return HStack(spacing: 12) {
            ZStack(alignment: .topLeading) {
                AvatarView(
                    initials: store.conversationInitials(conversation, viewer: viewer),
                    size: 50,
                    filled: isOfficialChannel
                )
                if isOfficialChannel {
                    Image(systemName: "pin.fill")
                        .font(.caption2)
                        .foregroundStyle(Theme.orange)
                        .offset(x: -4, y: -4)
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(store.conversationTitle(conversation, viewer: viewer))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Text(conversation.lastMessage?.text ?? "Nouvelle conversation")
                    .font(.footnote)
                    .foregroundStyle(unread > 0 ? Theme.ink : Theme.inkSecondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 4)

            VStack(alignment: .trailing, spacing: 6) {
                Text(conversation.lastMessage.map { Fmt.conversationStamp($0.sentAt) } ?? "")
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
                if unread > 0 {
                    Text("\(unread)")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(minWidth: 22, minHeight: 22)
                        .background(Theme.orange, in: .circle)
                }
            }
        }
        .assoCard(padding: 14)
    }
}

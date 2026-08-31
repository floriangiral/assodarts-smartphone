import SwiftUI
import PhotosUI

/// A private thread between a member and the bureau (or two people of the club).
struct ConversationView: View {
    let conversationId: UUID

    @Environment(AppStore.self) private var store

    @State private var draft: String = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var attachment: Data?
    @FocusState private var isInputFocused: Bool

    private var conversation: Conversation? {
        store.db.conversations.first { $0.id == conversationId }
    }

    var body: some View {
        Group {
            if let conversation, let user = store.currentUser {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(groupedMessages(conversation), id: \.id) { group in
                                Text(Fmt.daySeparator(group.date))
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(Theme.inkSecondary)
                                    .padding(.vertical, 8)

                                ForEach(group.messages) { message in
                                    MessageBubble(
                                        message: message,
                                        isMine: message.senderId == user.id,
                                        senderInitials: senderInitials(message, viewer: user),
                                        showsReadReceipt: isLastReadMine(message, in: conversation, user: user)
                                    )
                                    .id(message.id)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }
                    .assoCanvas()
                    .onAppear {
                        store.markRead(conversationId, by: user.id)
                        scrollToEnd(proxy, conversation: conversation)
                    }
                    .onChange(of: conversation.messages.count) { _, _ in
                        scrollToEnd(proxy, conversation: conversation)
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    inputBar(user: user)
                }
                .navigationTitle(store.conversationTitle(conversation, viewer: user))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .principal) {
                        VStack(spacing: 1) {
                            Text(store.conversationTitle(conversation, viewer: user))
                                .font(.headline)
                                .foregroundStyle(Theme.ink)
                            Text(store.conversationSubtitle(conversation, viewer: user))
                                .font(.caption2)
                                .foregroundStyle(Theme.inkSecondary)
                                .lineLimit(1)
                        }
                    }
                }
            } else {
                ContentUnavailableView("Conversation introuvable", systemImage: "bubble.left")
            }
        }
        .task(id: photoItem) {
            guard let photoItem,
                  let data = try? await photoItem.loadTransferable(type: Data.self) else { return }
            attachment = data
        }
    }

    // MARK: - Input

    private func inputBar(user: Member) -> some View {
        VStack(spacing: 8) {
            if let attachment, let image = UIImage(data: attachment) {
                HStack {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 54, height: 54)
                        .clipShape(.rect(cornerRadius: 10))
                    Text("Photo jointe")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    Button {
                        self.attachment = nil
                        photoItem = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }
                .padding(.horizontal, 16)
            }

            HStack(spacing: 10) {
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Image(systemName: "paperclip")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.navy)
                        .frame(width: 38, height: 38)
                        .background(Theme.canvas, in: .circle)
                }

                TextField("Votre message…", text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($isInputFocused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Theme.canvas, in: .capsule)

                Button {
                    send(from: user)
                } label: {
                    Image(systemName: "paperplane.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(canSend ? Theme.navy : Theme.navy.opacity(0.35), in: .circle)
                }
                .disabled(!canSend)
                .buttonStyle(PressableButtonStyle())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .background(Theme.surface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.border).frame(height: 1)
        }
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespaces).isEmpty || attachment != nil
    }

    private func send(from user: Member) {
        guard store.send(text: draft, imageData: attachment, in: conversationId, from: user.id) else { return }
        draft = ""
        attachment = nil
        photoItem = nil
    }

    // MARK: - Helpers

    private struct MessageGroup: Identifiable {
        let id: String
        let date: Date
        let messages: [Message]
    }

    private func groupedMessages(_ conversation: Conversation) -> [MessageGroup] {
        let calendar = Calendar.current
        var groups: [MessageGroup] = []
        for message in conversation.messages.sorted(by: { $0.sentAt < $1.sentAt }) {
            let day = calendar.startOfDay(for: message.sentAt)
            if let last = groups.last, calendar.isDate(last.date, inSameDayAs: day) {
                groups[groups.count - 1] = MessageGroup(
                    id: last.id,
                    date: last.date,
                    messages: last.messages + [message]
                )
            } else {
                groups.append(MessageGroup(id: day.ISO8601Format(), date: day, messages: [message]))
            }
        }
        return groups
    }

    private func senderInitials(_ message: Message, viewer: Member) -> String {
        guard let conversation else { return "??" }
        if conversation.kind == .bureau, !viewer.role.canManageClub, message.senderId != viewer.id {
            return "FB"
        }
        return store.member(message.senderId)?.initials ?? "??"
    }

    private func isLastReadMine(_ message: Message, in conversation: Conversation, user: Member) -> Bool {
        guard message.senderId == user.id else { return false }
        let mine = conversation.messages.filter { $0.senderId == user.id }
        guard let last = mine.last, last.id == message.id else { return false }
        return last.readBy.contains { $0 != user.id }
    }

    private func scrollToEnd(_ proxy: ScrollViewProxy, conversation: Conversation) {
        guard let last = conversation.messages.last else { return }
        withAnimation(.easeOut(duration: 0.25)) {
            proxy.scrollTo(last.id, anchor: .bottom)
        }
    }
}

/// A single chat bubble.
struct MessageBubble: View {
    let message: Message
    let isMine: Bool
    let senderInitials: String
    let showsReadReceipt: Bool

    var body: some View {
        VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
            HStack(alignment: .bottom, spacing: 8) {
                if !isMine {
                    AvatarView(initials: senderInitials, size: 34, filled: true)
                }

                VStack(alignment: .leading, spacing: 6) {
                    if let data = message.imageData, let image = UIImage(data: data) {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(maxWidth: 220, maxHeight: 220)
                            .clipShape(.rect(cornerRadius: 12))
                    }
                    if !message.text.isEmpty {
                        Text(message.text)
                            .font(.subheadline)
                            .foregroundStyle(isMine ? .white : Theme.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Text(Fmt.time(message.sentAt))
                        .font(.caption2)
                        .foregroundStyle(isMine ? Color.white.opacity(0.7) : Theme.inkSecondary)
                        .frame(maxWidth: .infinity, alignment: isMine ? .trailing : .leading)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isMine ? Theme.navy : Theme.surface)
                .clipShape(.rect(cornerRadius: 16))
                .overlay {
                    if !isMine {
                        RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1)
                    }
                }
                .frame(maxWidth: 280, alignment: .leading)

                if isMine {
                    Spacer(minLength: 0)
                }
            }
            .frame(maxWidth: .infinity, alignment: isMine ? .trailing : .leading)

            if showsReadReceipt {
                Text("Lu \(Fmt.time(message.sentAt))")
                    .font(.caption2)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
    }
}

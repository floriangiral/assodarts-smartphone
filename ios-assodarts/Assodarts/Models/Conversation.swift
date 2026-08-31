import Foundation

/// A private message inside a conversation.
struct Message: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var senderId: UUID
    var text: String
    var sentAt: Date = .now
    var readBy: [UUID] = []
    var imageData: Data?
}

/// Kind of private thread.
enum ConversationKind: String, Codable, Sendable {
    /// Official club channel: one member on one side, the whole bureau on the other.
    case bureau
    /// One-to-one thread between two people of the same club.
    case direct
}

/// A private, per-club conversation. Never crosses tenant boundaries.
struct Conversation: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var clubId: UUID
    var kind: ConversationKind
    /// For a bureau channel this holds the member; for a direct thread, both people.
    var participantIds: [UUID]
    var messages: [Message] = []

    var lastMessage: Message? { messages.last }

    var updatedAt: Date { messages.last?.sentAt ?? .distantPast }

    func unreadCount(for memberId: UUID) -> Int {
        messages.filter { $0.senderId != memberId && !$0.readBy.contains(memberId) }.count
    }

    /// The other side of a direct thread.
    func counterpartId(for memberId: UUID) -> UUID? {
        participantIds.first { $0 != memberId }
    }
}

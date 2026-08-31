import Foundation

/// A club announcement published by the bureau to its members.
struct Announcement: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var clubId: UUID
    var title: String
    var body: String
    var authorId: UUID
    var publishedAt: Date = .now
    var isPinned: Bool = false
    var readBy: [UUID] = []
}

/// Audience of a platform-wide announcement broadcast from the developer console.
enum BroadcastAudience: String, Codable, CaseIterable, Identifiable, Sendable {
    case all
    case admins

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "Tous les utilisateurs"
        case .admins: "Admins & bureaux"
        }
    }
}

/// An announcement broadcast by the platform developer to every club.
struct PlatformAnnouncement: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var title: String
    var body: String
    var audience: BroadcastAudience
    var publishedAt: Date = .now
}

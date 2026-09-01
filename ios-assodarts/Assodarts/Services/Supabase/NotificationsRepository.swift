import Foundation
import Supabase

nonisolated struct NotificationReadUpdate: Encodable, Sendable {
    let readAt: Date

    enum CodingKeys: String, CodingKey {
        case readAt = "read_at"
    }
}

nonisolated struct DeviceTokenUpsert: Encodable, Sendable {
    let memberId: UUID
    let token: String
    let platform: String
    let environment: String
    let locale: String

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case token
        case platform
        case environment
        case locale
    }
}

/// The member's notification inbox, filled server-side by database triggers so
/// an announcement or a validated payment reaches everyone concerned even when
/// their phone was closed.
enum NotificationsRepository {
    /// Most recent notifications for the signed-in member. RLS already limits
    /// the rows to their own.
    static func load(limit: Int = 60) async throws -> [AppNotification] {
        try await Backend.client
            .from("notifications")
            .select()
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    static func markRead(ids: [UUID]) async throws {
        guard !ids.isEmpty else { return }
        try await Backend.client
            .from("notifications")
            .update(NotificationReadUpdate(readAt: Date()))
            .in("id", values: ids.map(\.uuidString))
            .execute()
    }

    static func markAllRead() async throws {
        try await Backend.client
            .from("notifications")
            .update(NotificationReadUpdate(readAt: Date()))
            .is("read_at", value: nil)
            .execute()
    }

    static func delete(id: UUID) async throws {
        try await Backend.client
            .from("notifications")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }

    /// Stores the APNs device token so the club can push to this phone once the
    /// production push certificate is in place.
    static func registerDeviceToken(_ token: String, memberId: UUID) async throws {
        let payload = DeviceTokenUpsert(
            memberId: memberId,
            token: token,
            platform: "ios",
            environment: "production",
            locale: Localization.shared.lang.rawValue
        )
        try await Backend.client
            .from("device_push_tokens")
            .upsert(payload, onConflict: "token")
            .execute()
    }
}

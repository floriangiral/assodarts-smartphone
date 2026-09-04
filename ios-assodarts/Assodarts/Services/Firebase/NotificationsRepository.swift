import FirebaseFirestore
import Foundation

/// Firestore stores camelCase fields; `AppNotification`/`NotificationPayload`
/// keep their own snake_case `CodingKeys` for local JSON persistence, so this
/// intermediate struct is mapped by hand below rather than decoded directly
/// into the app model.
struct RemoteNotification: Codable {
    @DocumentID var id: String?
    let memberId: String
    let clubId: String
    let kind: String
    let title: String
    let body: String
    let payload: RemoteNotificationPayload?
    let createdAt: Date
    let readAt: Date?
}

nonisolated struct RemoteNotificationPayload: Codable, Sendable {
    let callId: String?
    let itemId: String?
    let announcementId: String?
    let eventId: String?
    let label: String?
    let amountCents: Int?
    let memberName: String?
    let method: String?
    let dueDate: String?
    let startsAt: String?
}

nonisolated struct DeviceTokenUpsert: Encodable, Sendable {
    let memberId: String
    let platform: String
    let environment: String
    let locale: String
}

/// The member's notification inbox, filled server-side by Cloud Function
/// triggers so an announcement or a validated payment reaches everyone
/// concerned even when their phone was closed.
enum NotificationsRepository {
    /// Most recent notifications for the signed-in member. Security rules
    /// already limit the documents to their own.
    static func load(memberId: UUID, limit: Int = 60) async throws -> [AppNotification] {
        let snap = try await Backend.firestore.collection("notifications")
            .whereField("memberId", isEqualTo: memberId.uuidString)
            .order(by: "createdAt", descending: true)
            .limit(to: limit)
            .getDocuments()

        return snap.documents.compactMap { doc in
            guard let remote = try? doc.data(as: RemoteNotification.self) else { return nil }
            return map(remote)
        }
    }

    private static func map(_ remote: RemoteNotification) -> AppNotification {
        let payload = remote.payload
        return AppNotification(
            id: remoteId(remote.id),
            clubId: remoteId(remote.clubId),
            memberId: remoteId(remote.memberId),
            kind: NotificationKind(rawValue: remote.kind) ?? .unknown,
            title: remote.title,
            body: remote.body,
            payload: NotificationPayload(
                callId: payload?.callId.map(remoteId),
                itemId: payload?.itemId.map(remoteId),
                announcementId: payload?.announcementId.map(remoteId),
                eventId: payload?.eventId.map(remoteId),
                label: payload?.label,
                amountCents: payload?.amountCents,
                memberName: payload?.memberName,
                method: payload?.method,
                dueDate: payload?.dueDate,
                startsAt: payload?.startsAt
            ),
            createdAt: remote.createdAt,
            readAt: remote.readAt
        )
    }

    static func markRead(ids: [UUID]) async throws {
        guard !ids.isEmpty else { return }
        let batch = Backend.firestore.batch()
        for id in ids {
            let ref = Backend.firestore.collection("notifications").document(id.uuidString)
            batch.updateData(["readAt": FieldValue.serverTimestamp()], forDocument: ref)
        }
        try await batch.commit()
    }

    static func markAllRead(memberId: UUID) async throws {
        let snap = try await Backend.firestore.collection("notifications")
            .whereField("memberId", isEqualTo: memberId.uuidString)
            .whereField("readAt", isEqualTo: NSNull())
            .getDocuments()
        guard !snap.documents.isEmpty else { return }

        let batch = Backend.firestore.batch()
        for doc in snap.documents {
            batch.updateData(["readAt": FieldValue.serverTimestamp()], forDocument: doc.reference)
        }
        try await batch.commit()
    }

    static func delete(id: UUID) async throws {
        try await Backend.firestore.collection("notifications").document(id.uuidString).delete()
    }

    /// Stores the FCM device token so the club can push to this phone.
    static func registerDeviceToken(_ token: String, memberId: UUID) async throws {
        let payload = DeviceTokenUpsert(
            memberId: memberId.uuidString,
            platform: currentPlatform,
            environment: "production",
            locale: Localization.shared.lang.rawValue
        )
        try Backend.firestore
            .collection("device_push_tokens")
            .document(token)
            .setData(from: payload, merge: true)
    }

    private static var currentPlatform: String {
        #if os(iOS)
        "ios"
        #else
        "android"
        #endif
    }
}


import Foundation
import SwiftUI

/// What a notification is about. The server stores a stable `kind` plus a small
/// payload rather than a finished sentence, so the app can render it in the
/// member's own language.
nonisolated enum NotificationKind: String, Codable, Sendable {
    case announcement
    case paymentDue = "payment_due"
    case paymentToConfirm = "payment_to_confirm"
    case paymentConfirmed = "payment_confirmed"
    case event
    case unknown

    nonisolated init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = NotificationKind(rawValue: raw) ?? .unknown
    }

    var symbol: String {
        switch self {
        case .announcement: "megaphone.fill"
        case .paymentDue: "eurosign.circle.fill"
        case .paymentToConfirm: "clock.badge.checkmark"
        case .paymentConfirmed: "checkmark.seal.fill"
        case .event: "calendar"
        case .unknown: "bell.fill"
        }
    }

    var tint: Color {
        switch self {
        case .announcement: Theme.orange
        case .paymentDue: Theme.amber
        case .paymentToConfirm: Theme.navy
        case .paymentConfirmed: Theme.green
        case .event: Theme.navy
        case .unknown: Theme.inkSecondary
        }
    }

    var background: Color {
        switch self {
        case .announcement: Theme.orangeTint
        case .paymentDue: Theme.amberTint
        case .paymentToConfirm: Theme.navyTint
        case .paymentConfirmed: Theme.greenTint
        case .event: Theme.navyTint
        case .unknown: Theme.navyTint
        }
    }
}

/// Extra data carried by a notification. Every field is optional because the
/// payload shape depends on the kind.
nonisolated struct NotificationPayload: Codable, Sendable, Hashable {
    var callId: UUID?
    var itemId: UUID?
    var announcementId: UUID?
    var eventId: UUID?
    var label: String?
    var amountCents: Int?
    var memberName: String?
    var method: String?
    /// Kept as text: these come straight out of `jsonb_build_object`.
    var dueDate: String?
    var startsAt: String?

    enum CodingKeys: String, CodingKey {
        case callId = "call_id"
        case itemId = "item_id"
        case announcementId = "announcement_id"
        case eventId = "event_id"
        case label
        case amountCents = "amount_cents"
        case memberName = "member_name"
        case method
        case dueDate = "due_date"
        case startsAt = "starts_at"
    }
}

/// One entry of a member's notification inbox.
nonisolated struct AppNotification: Identifiable, Codable, Sendable, Hashable {
    let id: UUID
    let clubId: UUID
    let memberId: UUID
    let kind: NotificationKind
    let title: String
    let body: String
    let payload: NotificationPayload
    let createdAt: Date
    var readAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case kind
        case title
        case body
        case payload
        case createdAt = "created_at"
        case readAt = "read_at"
    }

    var isUnread: Bool { readAt == nil }

    /// Headline, localized from the kind rather than from stored text.
    var localizedTitle: String {
        switch kind {
        case .announcement:
            return tr("Nouvelle annonce", "New announcement")
        case .paymentDue:
            return tr("Nouveau paiement à régler", "New payment to settle")
        case .paymentToConfirm:
            return tr("Paiement à valider", "Payment to confirm")
        case .paymentConfirmed:
            return tr("Paiement confirmé", "Payment confirmed")
        case .event:
            return tr("Nouvel événement", "New event")
        case .unknown:
            return title.isEmpty ? tr("Notification", "Notification") : title
        }
    }

    /// One-line detail built from the payload, with the server text as fallback.
    var localizedBody: String {
        let label = payload.label ?? title
        let amount = payload.amountCents.map(Fmt.money)

        switch kind {
        case .announcement:
            return title.isEmpty ? body : title
        case .paymentDue:
            guard let amount else { return label }
            return tr("\(label) · \(amount) à régler", "\(label) · \(amount) to settle")
        case .paymentToConfirm:
            let who = payload.memberName ?? tr("Un membre", "A member")
            guard let amount else {
                return tr("\(who) a déclaré un paiement.", "\(who) declared a payment.")
            }
            return tr("\(who) déclare \(amount) pour \(label).", "\(who) declared \(amount) for \(label).")
        case .paymentConfirmed:
            guard let amount else { return label }
            return tr("\(label) · \(amount) encaissé", "\(label) · \(amount) received")
        case .event:
            return body.isEmpty ? label : "\(label) · \(body)"
        case .unknown:
            return body
        }
    }

    /// Where tapping the notification takes the member.
    var route: ClubRoute? {
        switch kind {
        case .announcement:
            return payload.announcementId.map(ClubRoute.announcement)
        case .event:
            return payload.eventId.map(ClubRoute.event)
        case .paymentDue, .paymentConfirmed:
            return .myPayments
        case .paymentToConfirm:
            return .paymentValidation
        case .unknown:
            return nil
        }
    }
}

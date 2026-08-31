import Foundation

/// The full persisted state of the app. Every collection carries a `clubId`
/// so tenant isolation is enforced by every read path in `AppStore`.
struct Database: Codable, Sendable {
    var clubs: [Club] = []
    var members: [Member] = []
    var announcements: [Announcement] = []
    var events: [ClubEvent] = []
    var tournaments: [Tournament] = []
    var paymentCalls: [PaymentCall] = []
    var conversations: [Conversation] = []
    var coupons: [Coupon] = []
    var platformAnnouncements: [PlatformAnnouncement] = []
}

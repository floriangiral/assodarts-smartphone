import Foundation

/// A discount code issued by the platform developer and applied to targeted
/// clubs at renewal. 100 % means the club subscription is offered.
struct Coupon: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var code: String
    var percent: Int
    var expiresAt: Date
    var clubIds: [UUID]
    var autoRenew: Bool
    var createdAt: Date = .now

    var isOffered: Bool { percent >= 100 }

    var discountLabel: String {
        isOffered ? "Offert" : "−\(percent) %"
    }

    var isExpired: Bool { expiresAt < .now }

    /// Price in cents after the discount is applied.
    func discountedCents(fromEuros euros: Int) -> Int {
        let full = euros * 100
        return full - (full * percent / 100)
    }
}

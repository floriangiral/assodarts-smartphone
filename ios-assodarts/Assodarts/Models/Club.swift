import Foundation

/// Subscription state of a club on the platform.
enum SubscriptionStatus: String, Codable, Sendable {
    case trial
    case active
    case grace
    case expired

    var label: String {
        switch self {
        case .trial: tr("free_trial")
        case .active: tr("active_subscription")
        case .grace: tr("grace_period")
        case .expired: tr("subscription_expired")
        }
    }
}

/// Annual, degressive pricing tier based on the number of members.
struct PricingTier: Identifiable, Sendable, Hashable {
    let id: String
    let priceEuros: Int
    let upperBound: Int

    var rangeLabel: String {
        switch id {
        case "essentiel": tr("1_to_20_members")
        case "club": tr("21_to_50_members")
        case "federal": tr("51_to_100_members")
        case "ligue": tr("101_to_200_members")
        default: tr("more_than_200_members")
        }
    }

    /// Localized commercial name of the tier.
    var name: String {
        switch id {
        case "essentiel": tr("essential")
        case "club": tr("club")
        case "federal": tr("federal")
        case "ligue": tr("league")
        default: tr("custom_quote")
        }
    }

    static let all: [PricingTier] = [
        PricingTier(id: "essentiel", priceEuros: 49, upperBound: 20),
        PricingTier(id: "club", priceEuros: 89, upperBound: 50),
        PricingTier(id: "federal", priceEuros: 149, upperBound: 100),
        PricingTier(id: "ligue", priceEuros: 229, upperBound: 200),
        PricingTier(id: "devis", priceEuros: 0, upperBound: .max)
    ]

    static func tier(forMemberCount count: Int) -> PricingTier {
        all.first { count <= $0.upperBound } ?? all[all.count - 1]
    }
}

/// A tenant of the platform. All club data is isolated by `clubId`.
struct Club: Identifiable, Codable, Sendable, Hashable {
    var id: UUID
    var name: String
    var city: String
    var createdAt: Date
    var renewalDate: Date
    var status: SubscriptionStatus
    var seedMemberCount: Int
    var couponCode: String?
    /// Where the club receives its members' payments. Filled in by the bureau
    /// or the admin from the club settings.
    var bank: ClubBankAccount?

    var shortName: String {
        name.replacingOccurrences(of: "Fléchettes Club de ", with: "FC ")
    }
}

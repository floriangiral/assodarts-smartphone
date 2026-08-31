import Foundation

/// Subscription state of a club on the platform.
enum SubscriptionStatus: String, Codable, Sendable {
    case trial
    case active
    case grace
    case expired

    var label: String {
        switch self {
        case .trial: tr("Essai gratuit", "Free trial")
        case .active: tr("Abonnement actif", "Active subscription")
        case .grace: tr("Délai de grâce", "Grace period")
        case .expired: tr("Abonnement expiré", "Subscription expired")
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
        case "essentiel": tr("1 à 20 membres", "1 to 20 members")
        case "club": tr("21 à 50 membres", "21 to 50 members")
        case "federal": tr("51 à 100 membres", "51 to 100 members")
        case "ligue": tr("101 à 200 membres", "101 to 200 members")
        default: tr("Plus de 200 membres", "More than 200 members")
        }
    }

    /// Localized commercial name of the tier.
    var name: String {
        switch id {
        case "essentiel": tr("Essentiel", "Essential")
        case "club": tr("Club", "Club")
        case "federal": tr("Fédéral", "Federal")
        case "ligue": tr("Ligue", "League")
        default: tr("Sur devis", "Custom quote")
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

    var shortName: String {
        name.replacingOccurrences(of: "Fléchettes Club de ", with: "FC ")
    }
}

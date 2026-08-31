import Foundation

/// Subscription state of a club on the platform.
enum SubscriptionStatus: String, Codable, Sendable {
    case trial
    case active
    case grace
    case expired

    var label: String {
        switch self {
        case .trial: "Essai gratuit"
        case .active: "Abonnement actif"
        case .grace: "Délai de grâce"
        case .expired: "Abonnement expiré"
        }
    }
}

/// Annual, degressive pricing tier based on the number of members.
struct PricingTier: Identifiable, Sendable, Hashable {
    let id: String
    let name: String
    let priceEuros: Int
    let upperBound: Int

    var rangeLabel: String {
        switch id {
        case "essentiel": "1 à 20 membres"
        case "club": "21 à 50 membres"
        case "federal": "51 à 100 membres"
        case "ligue": "101 à 200 membres"
        default: "Plus de 200 membres"
        }
    }

    static let all: [PricingTier] = [
        PricingTier(id: "essentiel", name: "Essentiel", priceEuros: 49, upperBound: 20),
        PricingTier(id: "club", name: "Club", priceEuros: 89, upperBound: 50),
        PricingTier(id: "federal", name: "Fédéral", priceEuros: 149, upperBound: 100),
        PricingTier(id: "ligue", name: "Ligue", priceEuros: 229, upperBound: 200),
        PricingTier(id: "devis", name: "Sur devis", priceEuros: 0, upperBound: .max)
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

import SwiftUI

/// Role of a user inside the platform. Permissions are role-derived everywhere.
enum Role: String, Codable, CaseIterable, Identifiable, Sendable {
    case membre
    case bureau
    case admin
    case developpeur

    var id: String { rawValue }

    var label: String {
        switch self {
        case .membre: "Membre"
        case .bureau: "Bureau"
        case .admin: "Admin"
        case .developpeur: "Développeur"
        }
    }

    var permissionSummary: String {
        switch self {
        case .membre: "Consulte les annonces, les événements et règle ses paiements"
        case .bureau: "Peut gérer les membres, les annonces et les appels à paiement"
        case .admin: "Gère l'ensemble du club, les rôles et l'abonnement"
        case .developpeur: "Accès à la console développeur de la plateforme"
        }
    }

    /// Bureau and admin share the club back-office capabilities.
    var canManageClub: Bool { self == .bureau || self == .admin }

    /// Only club admins can change roles and manage the subscription.
    var canManageRoles: Bool { self == .admin }

    /// Roles assignable by a club admin.
    static var clubRoles: [Role] { [.membre, .bureau, .admin] }

    var badgeBackground: Color {
        switch self {
        case .membre: Theme.navyTint
        case .bureau: Theme.navy
        case .admin: Theme.orange
        case .developpeur: Theme.navyDeep
        }
    }

    var badgeForeground: Color {
        switch self {
        case .membre: Theme.navy
        default: .white
        }
    }
}

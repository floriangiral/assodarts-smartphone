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
        case .membre: tr("member")
        case .bureau: tr("committee")
        case .admin: tr("admin")
        case .developpeur: tr("developer")
        }
    }

    var permissionSummary: String {
        switch self {
        case .membre:
            tr("reads_announcements_and_events_and_pays_their_dues")
        case .bureau:
            tr("can_manage_members_announcements_and_payment_requests")
        case .admin:
            tr("manages_the_whole_club_roles_and_the_subscription")
        case .developpeur:
            tr("access_to_the_platform_developer_console")
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

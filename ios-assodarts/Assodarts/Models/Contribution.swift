import Foundation

enum ContributionOption: String, Codable, CaseIterable, Identifiable, Sendable {
    case memberFee = "member_fee"
    case playerLicense = "player_license"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .memberFee: tr("member_contribution")
        case .playerLicense: tr("player_license_contribution")
        }
    }

    var detail: String {
        switch self {
        case .memberFee: tr("member_contribution_detail")
        case .playerLicense: tr("player_license_contribution_detail")
        }
    }
}

struct ContributionSeason: Codable, Hashable, Sendable {
    let id: String
    let label: String
    let memberAmountCents: Int
    let playerAmountCents: Int
    let status: String
    let selectedOption: ContributionOption?
    let selectedStatus: String?

    var isPublished: Bool { status == "published" }
    var hasSelection: Bool { selectedOption != nil }
}
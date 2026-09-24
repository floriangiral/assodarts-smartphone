import Foundation

/// A person belonging to a club (or the platform developer, whose `clubId` is
/// the developer workspace).
struct Member: Identifiable, Codable, Sendable, Hashable {
    var id: UUID
    var clubId: UUID
    var firstName: String
    var lastName: String
    var email: String
    var password: String
    var phone: String
    var birthDate: Date?
    var role: Role
    var isLicensed: Bool
    var contributionStatus: String?
    var licenceNumber: String
    var joinedAt: Date
    var isActive: Bool
    var photoData: Data?
    var photoPath: String?
    var notifyAnnouncements: Bool
    var notifyEvents: Bool
    var notifyPayments: Bool
    var notifyTournaments: Bool
    var eventsAttended: Int
    var tournamentsPlayed: Int
    var average: Double

    var fullName: String { "\(firstName) \(lastName)" }

    var initials: String {
        let first = firstName.first.map(String.init) ?? ""
        let last = lastName.first.map(String.init) ?? ""
        return (first + last).uppercased()
    }

    var licenceLabel: String {
        isLicensed ? tr("licensed") : tr("standard_member")
    }

    /// Groups the member's less-essential creation settings to keep the initializer readable.
    struct Options {
        var password: String = ""
        var phone: String = ""
        var birthDate: Date?
        var role: Role = .membre
        var isLicensed = false
        var contributionStatus: String?
        var licenceNumber: String = ""
        var joinedAt: Date = .now
        var isActive = true
        var photoData: Data?
        var photoPath: String?
        var notifyAnnouncements = true
        var notifyEvents = true
        var notifyPayments = true
        var notifyTournaments = false
        var eventsAttended = 0
        var tournamentsPlayed = 0
        var average: Double = 0
    }

    init(
        id: UUID = UUID(),
        clubId: UUID,
        firstName: String,
        lastName: String,
        email: String,
        options: Options = Options()
    ) {
        self.id = id
        self.clubId = clubId
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.password = options.password
        self.phone = options.phone
        self.birthDate = options.birthDate
        self.role = options.role
        self.isLicensed = options.isLicensed
        self.contributionStatus = options.contributionStatus
        self.licenceNumber = options.licenceNumber
        self.joinedAt = options.joinedAt
        self.isActive = options.isActive
        self.photoData = options.photoData
        self.photoPath = options.photoPath
        self.notifyAnnouncements = options.notifyAnnouncements
        self.notifyEvents = options.notifyEvents
        self.notifyPayments = options.notifyPayments
        self.notifyTournaments = options.notifyTournaments
        self.eventsAttended = options.eventsAttended
        self.tournamentsPlayed = options.tournamentsPlayed
        self.average = options.average
    }
}

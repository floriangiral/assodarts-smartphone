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
    var licenceNumber: String
    var joinedAt: Date
    var isActive: Bool
    var photoData: Data?
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
        isLicensed ? "Licencié" : "Membre simple"
    }

    init(
        id: UUID = UUID(),
        clubId: UUID,
        firstName: String,
        lastName: String,
        email: String,
        password: String = "demo",
        phone: String = "",
        birthDate: Date? = nil,
        role: Role = .membre,
        isLicensed: Bool = false,
        licenceNumber: String = "",
        joinedAt: Date = .now,
        isActive: Bool = true,
        photoData: Data? = nil,
        notifyAnnouncements: Bool = true,
        notifyEvents: Bool = true,
        notifyPayments: Bool = true,
        notifyTournaments: Bool = false,
        eventsAttended: Int = 0,
        tournamentsPlayed: Int = 0,
        average: Double = 0
    ) {
        self.id = id
        self.clubId = clubId
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.password = password
        self.phone = phone
        self.birthDate = birthDate
        self.role = role
        self.isLicensed = isLicensed
        self.licenceNumber = licenceNumber
        self.joinedAt = joinedAt
        self.isActive = isActive
        self.photoData = photoData
        self.notifyAnnouncements = notifyAnnouncements
        self.notifyEvents = notifyEvents
        self.notifyPayments = notifyPayments
        self.notifyTournaments = notifyTournaments
        self.eventsAttended = eventsAttended
        self.tournamentsPlayed = tournamentsPlayed
        self.average = average
    }
}

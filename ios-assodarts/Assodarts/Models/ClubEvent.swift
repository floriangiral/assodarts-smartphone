import Foundation
import SwiftUI

/// Nature of a club event.
enum EventKind: String, Codable, CaseIterable, Identifiable, Sendable {
    case entrainement
    case competition
    case reunion
    case convivial

    var id: String { rawValue }

    var label: String {
        switch self {
        case .entrainement: "Entraînement"
        case .competition: "Compétition"
        case .reunion: "Réunion"
        case .convivial: "Convivialité"
        }
    }

    var symbol: String {
        switch self {
        case .entrainement: "target"
        case .competition: "flag.checkered"
        case .reunion: "person.2"
        case .convivial: "fork.knife"
        }
    }

    var tint: Color {
        switch self {
        case .entrainement: Theme.navy
        case .competition: Theme.orange
        case .reunion: Theme.inkSecondary
        case .convivial: Theme.green
        }
    }
}

/// An event in the club calendar, with member attendance.
struct ClubEvent: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var clubId: UUID
    var title: String
    var kind: EventKind
    var date: Date
    var location: String
    var details: String
    var attendeeIds: [UUID] = []
    var declinedIds: [UUID] = []

    func response(for memberId: UUID) -> Bool? {
        if attendeeIds.contains(memberId) { return true }
        if declinedIds.contains(memberId) { return false }
        return nil
    }
}

import Foundation

/// A freely described result line recorded by a marqueur. There is deliberately
/// no fixed bracket vocabulary: "tableau" and "tour" are free text.
struct TournamentEntry: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var tableau: String
    var tour: String
    var playerA: String
    var playerB: String
    var scoreA: Int
    var scoreB: Int
    var note: String
    var recordedById: UUID
    var recordedAt: Date = .now

    var scoreLabel: String { "\(scoreA) – \(scoreB)" }

    var winner: String { scoreA >= scoreB ? playerA : playerB }
}

/// A tournament followed by the club. Information only — no live scoring.
struct Tournament: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var clubId: UUID
    var name: String
    var date: Date
    var location: String
    var markerIds: [UUID] = []
    var entries: [TournamentEntry] = []
    var isFinished: Bool = false

    var statusLabel: String {
        if isFinished { return "Terminé" }
        return date < .now ? "En cours" : "À venir"
    }

    /// Distinct "tableaux" recorded so far, in order of first appearance.
    var tableaux: [String] {
        var seen: [String] = []
        for entry in entries where !seen.contains(entry.tableau) {
            seen.append(entry.tableau)
        }
        return seen
    }
}

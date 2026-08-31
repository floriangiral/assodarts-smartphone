import Foundation
import SwiftUI

/// Category of a payment call created by the bureau.
enum PaymentCategory: String, Codable, CaseIterable, Identifiable, Sendable {
    case cotisation
    case tenue
    case deplacement
    case autre

    var id: String { rawValue }

    var label: String {
        switch self {
        case .cotisation: tr("Cotisation", "Membership fee")
        case .tenue: tr("Tenue", "Kit")
        case .deplacement: tr("Déplacement", "Travel")
        case .autre: tr("Autre", "Other")
        }
    }

    var symbol: String {
        switch self {
        case .cotisation: "person.text.rectangle"
        case .tenue: "tshirt"
        case .deplacement: "bus"
        case .autre: "tag"
        }
    }
}

/// Live state of an individual member's line inside a payment call.
enum PaymentState: String, Sendable {
    case paid
    case pending
    case late

    var label: String {
        switch self {
        case .paid: tr("Payé", "Paid")
        case .pending: tr("En attente", "Pending")
        case .late: tr("En retard", "Overdue")
        }
    }

    var tint: Color {
        switch self {
        case .paid: Theme.green
        case .pending: Theme.amber
        case .late: Theme.red
        }
    }

    var background: Color {
        switch self {
        case .paid: Theme.greenTint
        case .pending: Theme.amberTint
        case .late: Theme.redTint
        }
    }
}

/// One member's line inside a payment call.
struct PaymentItem: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var memberId: UUID
    var isPaid: Bool = false
    var paidAt: Date?
    var remindedAt: Date?

    func state(dueDate: Date) -> PaymentState {
        if isPaid { return .paid }
        return dueDate < .now ? .late : .pending
    }
}

/// A payment call ("appel à paiement") issued by the bureau, in bulk or to a
/// single member.
struct PaymentCall: Identifiable, Codable, Sendable, Hashable {
    var id: UUID = UUID()
    var clubId: UUID
    var label: String
    var category: PaymentCategory
    var amountCents: Int
    var dueDate: Date
    var createdAt: Date = .now
    var createdById: UUID
    var reference: String
    var notify: Bool = true
    var items: [PaymentItem]

    var paidCount: Int { items.filter(\.isPaid).count }
    var pendingCount: Int { items.filter { $0.state(dueDate: dueDate) == .pending }.count }
    var lateCount: Int { items.filter { $0.state(dueDate: dueDate) == .late }.count }
    var unpaidCount: Int { items.count - paidCount }

    var expectedCents: Int { amountCents * items.count }
    var collectedCents: Int { amountCents * paidCount }

    var progress: Double {
        guard !items.isEmpty else { return 0 }
        return Double(paidCount) / Double(items.count)
    }

    func item(for memberId: UUID) -> PaymentItem? {
        items.first { $0.memberId == memberId }
    }
}

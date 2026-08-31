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

/// How a member paid, or intends to pay. Card, Apple Pay and Google Pay are
/// collected online; transfer and cash are declared by the member and confirmed
/// by the bureau once the money has actually arrived.
enum PaymentMethodKind: String, Codable, CaseIterable, Identifiable, Sendable {
    case applePay
    case googlePay
    case card
    case transfer
    case cash

    var id: String { rawValue }

    var label: String {
        switch self {
        case .applePay: "Apple Pay"
        case .googlePay: "Google Pay"
        case .card: tr("Carte bancaire", "Bank card")
        case .transfer: tr("Virement bancaire", "Bank transfer")
        case .cash: tr("Espèces", "Cash")
        }
    }

    var detail: String {
        switch self {
        case .applePay: tr("Paiement immédiat, Face ID", "Instant payment, Face ID")
        case .googlePay: tr("Paiement immédiat sur Android", "Instant payment on Android")
        case .card: tr("Visa, Mastercard, CB", "Visa, Mastercard, CB")
        case .transfer: tr("RIB du club · à valider par le bureau", "Club bank details · confirmed by the committee")
        case .cash: tr("Sur place · à valider par le bureau", "In person · confirmed by the committee")
        }
    }

    var symbol: String {
        switch self {
        case .applePay: "apple.logo"
        case .googlePay: "g.circle.fill"
        case .card: "creditcard.fill"
        case .transfer: "building.columns.fill"
        case .cash: "banknote.fill"
        }
    }

    /// Transfer and cash land in the bureau's validation queue.
    var requiresValidation: Bool { self == .transfer || self == .cash }

    /// Collected online through the club's payment account.
    var isOnline: Bool { !requiresValidation }

    /// Google Pay only exists on Android; the iOS app shows it as unavailable.
    var isAvailableOnThisDevice: Bool { self != .googlePay }
}

/// Live state of an individual member's line inside a payment call.
enum PaymentState: String, Sendable {
    case paid
    case awaitingValidation
    case pending
    case late

    var label: String {
        switch self {
        case .paid: tr("Payé", "Paid")
        case .awaitingValidation: tr("À valider", "To confirm")
        case .pending: tr("En attente", "Pending")
        case .late: tr("En retard", "Overdue")
        }
    }

    var tint: Color {
        switch self {
        case .paid: Theme.green
        case .awaitingValidation: Theme.navy
        case .pending: Theme.amber
        case .late: Theme.red
        }
    }

    var background: Color {
        switch self {
        case .paid: Theme.greenTint
        case .awaitingValidation: Theme.navyTint
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
    /// Method chosen by the member, or recorded by the bureau.
    var method: PaymentMethodKind?
    /// Set when a member declares a transfer or a cash payment.
    var declaredAt: Date?
    /// Free reference given by the member, e.g. the transfer label.
    var reference: String?
    /// Bureau or admin member who confirmed the money was received.
    var validatedById: UUID?

    /// A declared payment waiting for the bureau to confirm receipt.
    var isAwaitingValidation: Bool { !isPaid && declaredAt != nil }

    func state(dueDate: Date) -> PaymentState {
        if isPaid { return .paid }
        if declaredAt != nil { return .awaitingValidation }
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
    var awaitingCount: Int { items.filter(\.isAwaitingValidation).count }
    var pendingCount: Int { items.filter { $0.state(dueDate: dueDate) == .pending }.count }
    var lateCount: Int { items.filter { $0.state(dueDate: dueDate) == .late }.count }
    var unpaidCount: Int { items.count - paidCount }
    /// Members who can still be chased: nothing paid and nothing declared.
    var chasableCount: Int { items.filter { !$0.isPaid && $0.declaredAt == nil }.count }

    var expectedCents: Int { amountCents * items.count }
    var collectedCents: Int { amountCents * paidCount }
    var awaitingCents: Int { amountCents * awaitingCount }

    var progress: Double {
        guard !items.isEmpty else { return 0 }
        return Double(paidCount) / Double(items.count)
    }

    func item(for memberId: UUID) -> PaymentItem? {
        items.first { $0.memberId == memberId }
    }
}

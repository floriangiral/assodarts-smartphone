import FirebaseFirestore
import Foundation

// MARK: - Read models
//
// One struct per Firestore collection actually used by the app. Document IDs
// are plain Firestore strings; the app's domain models use `UUID`, so callers
// convert with `UUID(uuidString:)` at the mapping boundary in
// `RemoteRepository`.

struct RemoteClub: Codable {
    @DocumentID var id: String?
    let name: String
    let address: String?
    let country: String?
    let createdAt: Date
    let subscriptionStatus: String
    let trialEndsAt: Date?
}

struct RemoteMembership: Codable {
    @DocumentID var id: String?
    let clubId: String
    let memberId: String
    let role: String
    let status: String
    let joinDate: Date
    let licenseNumber: String?
}

struct RemoteMember: Codable {
    @DocumentID var id: String?
    let authUid: String
    let clubId: String?
    let firstName: String
    let lastName: String
    let email: String
    let phone: String?
    let status: String
}

struct RemoteBankAccount: Codable {
    @DocumentID var id: String?
    let clubId: String
    let holder: String
    let iban: String
    let bic: String
    let bankName: String
    let stripeStatus: String
    let stripeAccountId: String?
    let acceptsTransfer: Bool
    let acceptsCash: Bool
    let transferNote: String
    let cashNote: String
    let updatedAt: Date?
    let updatedByMemberId: String?
}

struct RemoteAnnouncement: Codable {
    @DocumentID var id: String?
    let clubId: String
    let createdByMemberId: String
    let title: String
    let body: String
    let isPinned: Bool
    let publishedAt: Date?
    let createdAt: Date
}

struct RemoteEvent: Codable {
    @DocumentID var id: String?
    let clubId: String
    let title: String
    let description: String?
    let startsAt: Date
    let location: String?
    let category: String
}

struct RemoteEventRegistration: Codable {
    @DocumentID var id: String?
    let clubId: String
    let eventId: String
    let memberId: String
    let status: String
}

struct RemotePaymentCall: Codable {
    @DocumentID var id: String?
    let clubId: String
    let title: String
    let detail: String
    let category: String
    let amountCents: Int
    let dueDate: Date
    let createdByMemberId: String?
    let createdAt: Date
}

struct RemotePaymentItem: Codable {
    @DocumentID var id: String?
    let paymentCallId: String
    let clubId: String
    let memberId: String
    let isPaid: Bool
    let paidAt: Date?
    let method: String?
    let declaredAt: Date?
    let reference: String?
    let validatedByMemberId: String?
    let remindedAt: Date?
}

// MARK: - Write models

nonisolated struct BankAccountUpsert: Encodable, Sendable {
    let clubId: String
    let holder: String
    let iban: String
    let bic: String
    let bankName: String
    let stripeStatus: String
    let stripeAccountId: String?
    let acceptsTransfer: Bool
    let acceptsCash: Bool
    let transferNote: String
    let cashNote: String
    let updatedByMemberId: String?
}

nonisolated struct PaymentCallInsert: Encodable, Sendable {
    let clubId: String
    let title: String
    let detail: String
    let category: String
    let amountCents: Int
    let currency: String
    let dueDate: Date
    let createdByMemberId: String
    let createdAt: Date
}

nonisolated struct PaymentItemInsert: Encodable, Sendable {
    let paymentCallId: String
    let clubId: String
    let memberId: String
    let isPaid: Bool
}

nonisolated struct AnnouncementInsert: Encodable, Sendable {
    let clubId: String
    let createdByMemberId: String
    let title: String
    let body: String
    let isPinned: Bool
    let publishedAt: Date
    let visibility: String
    let createdAt: Date
}

nonisolated struct MemberSelfInsert: Encodable, Sendable {
    let authUid: String
    let clubId: String?
    let firstName: String
    let lastName: String
    let displayName: String
    let email: String
    let phone: String?
    let status: String
}

// MARK: - Mapping to app models

extension Role {
    /// Maps the `memberships.role` field onto the app's role enum.
    nonisolated static func fromRemote(_ raw: String) -> Role {
        switch raw {
        case "admin": .admin
        case "board", "bureau", "treasurer": .bureau
        default: .membre
        }
    }

    /// The value written back into `memberships.role`.
    nonisolated var remoteValue: String {
        switch self {
        case .admin, .developpeur: "admin"
        case .bureau: "board"
        case .membre: "member"
        }
    }
}

extension SubscriptionStatus {
    nonisolated static func fromRemote(_ raw: String) -> SubscriptionStatus {
        SubscriptionStatus(rawValue: raw) ?? .trial
    }
}

extension EventKind {
    nonisolated static func fromRemote(_ raw: String) -> EventKind {
        switch raw {
        case "training", "entrainement", "practice": .entrainement
        case "competition", "tournament", "match": .competition
        case "meeting", "reunion", "assembly": .reunion
        default: .convivial
        }
    }

    nonisolated var remoteValue: String {
        switch self {
        case .entrainement: "training"
        case .competition: "competition"
        case .reunion: "meeting"
        case .convivial: "social"
        }
    }
}

extension StripeAccountStatus {
    nonisolated static func fromRemote(_ raw: String) -> StripeAccountStatus {
        switch raw {
        case "pending", "restricted": .pending
        case "verified", "enabled", "active": .verified
        default: .notConnected
        }
    }

    nonisolated var remoteValue: String {
        switch self {
        case .notConnected: "not_connected"
        case .pending: "pending"
        case .verified: "verified"
        }
    }
}

extension ClubBankAccount {
    nonisolated init(remote: RemoteBankAccount) {
        self.init(
            holder: remote.holder,
            iban: remote.iban,
            bic: remote.bic,
            bankName: remote.bankName,
            stripeStatus: .fromRemote(remote.stripeStatus),
            stripeAccountId: remote.stripeAccountId,
            acceptsTransfer: remote.acceptsTransfer,
            acceptsCash: remote.acceptsCash,
            transferNote: remote.transferNote,
            cashNote: remote.cashNote,
            updatedAt: remote.updatedAt,
            updatedById: remote.updatedByMemberId.map(remoteId)
        )
    }
}

extension PaymentMethodKind {
    nonisolated static func fromRemote(_ raw: String?) -> PaymentMethodKind? {
        guard let raw else { return nil }
        switch raw {
        case "apple_pay", "applePay": return .applePay
        case "google_pay", "googlePay": return .googlePay
        case "card": return .card
        case "transfer": return .transfer
        case "cash": return .cash
        default: return nil
        }
    }

    nonisolated var remoteValue: String {
        switch self {
        case .applePay: "apple_pay"
        case .googlePay: "google_pay"
        case .card: "card"
        case .transfer: "transfer"
        case .cash: "cash"
        }
    }
}

extension PaymentCategory {
    nonisolated static func fromRemote(_ raw: String) -> PaymentCategory {
        PaymentCategory(rawValue: raw) ?? .autre
    }
}

/// Firestore document IDs are strings; app models key everything on `UUID`.
/// Invalid/missing IDs fall back to a fresh `UUID` rather than crashing —
/// such a row is simply orphaned from the rest of that sync.
nonisolated func remoteId(_ raw: String?) -> UUID {
    raw.flatMap(UUID.init(uuidString:)) ?? UUID()
}

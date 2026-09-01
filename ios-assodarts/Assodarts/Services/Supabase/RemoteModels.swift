import Foundation

// MARK: - Read models
//
// One struct per table actually used by the app. They are deliberately narrow:
// the Supabase schema carries more columns than the iOS app needs today, and
// decoding only what we use keeps the payloads small.

nonisolated struct RemoteClub: Codable, Sendable {
    let id: UUID
    let name: String
    let address: String?
    let country: String?
    let createdAt: Date
    let subscriptionStatus: String
    let trialEndsAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case address
        case country
        case createdAt = "created_at"
        case subscriptionStatus = "subscription_status"
        case trialEndsAt = "trial_ends_at"
    }
}

nonisolated struct RemoteMembership: Codable, Sendable {
    let id: UUID
    let clubId: UUID
    let memberId: UUID
    let role: String
    let status: String
    let joinDate: Date
    let licenseNumber: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case role
        case status
        case joinDate = "join_date"
        case licenseNumber = "license_number"
    }
}

nonisolated struct RemoteMember: Codable, Sendable {
    let id: UUID
    let firstName: String
    let lastName: String
    let email: String
    let phone: String?
    let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case phone
        case status
    }
}

nonisolated struct RemoteBankAccount: Codable, Sendable {
    let clubId: UUID
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
    let updatedByMemberId: UUID?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case holder
        case iban
        case bic
        case bankName = "bank_name"
        case stripeStatus = "stripe_status"
        case stripeAccountId = "stripe_account_id"
        case acceptsTransfer = "accepts_transfer"
        case acceptsCash = "accepts_cash"
        case transferNote = "transfer_note"
        case cashNote = "cash_note"
        case updatedAt = "updated_at"
        case updatedByMemberId = "updated_by_member_id"
    }
}

nonisolated struct RemoteAnnouncement: Codable, Sendable {
    let id: UUID
    let clubId: UUID
    let createdByMemberId: UUID
    let title: String
    let body: String
    let isPinned: Bool
    let publishedAt: Date?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case createdByMemberId = "created_by_member_id"
        case title
        case body
        case isPinned = "is_pinned"
        case publishedAt = "published_at"
        case createdAt = "created_at"
    }
}

nonisolated struct RemoteEvent: Codable, Sendable {
    let id: UUID
    let clubId: UUID
    let title: String
    let description: String?
    let startsAt: Date
    let location: String?
    let category: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case title
        case description
        case startsAt = "starts_at"
        case location
        case category
    }
}

nonisolated struct RemoteEventRegistration: Codable, Sendable {
    let id: UUID
    let eventId: UUID
    let memberId: UUID
    let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case eventId = "event_id"
        case memberId = "member_id"
        case status
    }
}

nonisolated struct RemotePaymentCall: Codable, Sendable {
    let id: UUID
    let clubId: UUID
    let title: String
    let detail: String
    let category: String
    let amountCents: Int
    let dueDate: Date
    let createdByMemberId: UUID?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case title
        case detail
        case category
        case amountCents = "amount_cents"
        case dueDate = "due_date"
        case createdByMemberId = "created_by_member_id"
        case createdAt = "created_at"
    }
}

nonisolated struct RemotePaymentItem: Codable, Sendable {
    let id: UUID
    let paymentCallId: UUID
    let clubId: UUID
    let memberId: UUID
    let isPaid: Bool
    let paidAt: Date?
    let method: String?
    let declaredAt: Date?
    let reference: String?
    let validatedByMemberId: UUID?
    let remindedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case paymentCallId = "payment_call_id"
        case clubId = "club_id"
        case memberId = "member_id"
        case isPaid = "is_paid"
        case paidAt = "paid_at"
        case method
        case declaredAt = "declared_at"
        case reference
        case validatedByMemberId = "validated_by_member_id"
        case remindedAt = "reminded_at"
    }
}

// MARK: - Write models

nonisolated struct BankAccountUpsert: Encodable, Sendable {
    let clubId: UUID
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
    let updatedByMemberId: UUID?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case holder
        case iban
        case bic
        case bankName = "bank_name"
        case stripeStatus = "stripe_status"
        case stripeAccountId = "stripe_account_id"
        case acceptsTransfer = "accepts_transfer"
        case acceptsCash = "accepts_cash"
        case transferNote = "transfer_note"
        case cashNote = "cash_note"
        case updatedByMemberId = "updated_by_member_id"
    }
}

nonisolated struct PaymentCallInsert: Encodable, Sendable {
    let id: UUID
    let clubId: UUID
    let title: String
    let detail: String
    let category: String
    let amountCents: Int
    let dueDate: Date
    let createdByMemberId: UUID

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case title
        case detail
        case category
        case amountCents = "amount_cents"
        case dueDate = "due_date"
        case createdByMemberId = "created_by_member_id"
    }
}

nonisolated struct PaymentItemInsert: Encodable, Sendable {
    let id: UUID
    let paymentCallId: UUID
    let clubId: UUID
    let memberId: UUID

    enum CodingKeys: String, CodingKey {
        case id
        case paymentCallId = "payment_call_id"
        case clubId = "club_id"
        case memberId = "member_id"
    }
}

nonisolated struct AnnouncementInsert: Encodable, Sendable {
    let id: UUID
    let clubId: UUID
    let createdByMemberId: UUID
    let title: String
    let body: String
    let isPinned: Bool
    let publishedAt: Date
    let visibility: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case createdByMemberId = "created_by_member_id"
        case title
        case body
        case isPinned = "is_pinned"
        case publishedAt = "published_at"
        case visibility
    }
}

nonisolated struct MemberSelfInsert: Encodable, Sendable {
    let id: UUID
    let firstName: String
    let lastName: String
    let displayName: String
    let email: String
    let phone: String?
    let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case firstName = "first_name"
        case lastName = "last_name"
        case displayName = "display_name"
        case email
        case phone
        case status
    }
}

/// Records a payment the bureau received outside the app. `declared_at` has to
/// be written as an explicit `null`, which a plain optional property would omit.
nonisolated struct PaymentItemPaidUpdate: Encodable, Sendable {
    let method: String?

    enum CodingKeys: String, CodingKey {
        case isPaid = "is_paid"
        case paidAt = "paid_at"
        case method
        case declaredAt = "declared_at"
        case updatedAt = "updated_at"
    }

    nonisolated func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        let now = Date()
        try container.encode(true, forKey: .isPaid)
        try container.encode(now, forKey: .paidAt)
        try container.encode(method, forKey: .method)
        try container.encodeNil(forKey: .declaredAt)
        try container.encode(now, forKey: .updatedAt)
    }
}

nonisolated struct PaymentItemReminderUpdate: Encodable, Sendable {
    let remindedAt: Date

    enum CodingKeys: String, CodingKey {
        case remindedAt = "reminded_at"
        case updatedAt = "updated_at"
    }

    nonisolated func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(remindedAt, forKey: .remindedAt)
        try container.encode(remindedAt, forKey: .updatedAt)
    }
}

nonisolated struct DeclarePaymentParams: Encodable, Sendable {
    let itemId: UUID
    let method: String
    let reference: String?

    enum CodingKeys: String, CodingKey {
        case itemId = "p_item_id"
        case method = "p_method"
        case reference = "p_reference"
    }
}

nonisolated struct PaymentItemIdParams: Encodable, Sendable {
    let itemId: UUID

    enum CodingKeys: String, CodingKey {
        case itemId = "p_item_id"
    }
}

// MARK: - Mapping to app models

extension Role {
    /// Maps the `memberships.role` text column onto the app's role enum.
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
            updatedById: remote.updatedByMemberId
        )
    }
}

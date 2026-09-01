import Foundation
import Supabase

/// Reads and writes the live club data.
///
/// Every query relies on Row Level Security for tenant isolation: the policies
/// only ever return rows of the clubs the signed-in member actually belongs to,
/// so no `club_id` filter is duplicated here as a security measure.
enum RemoteRepository {
    /// Everything the app needs for one signed-in member, already mapped onto
    /// the local models so the whole UI keeps working unchanged.
    struct Snapshot: Sendable {
        var database: Database
        var currentMemberId: UUID
        var activeClubId: UUID
    }

    // MARK: - Loading

    static func loadSnapshot(for userId: UUID) async throws -> Snapshot {
        let memberships: [RemoteMembership] = try await Backend.client
            .from("memberships")
            .select("id, club_id, member_id, role, status, join_date, license_number")
            .execute()
            .value

        let mine = memberships.filter { $0.memberId == userId && $0.status == "active" }
        // Admins and bureau land on the club they manage first.
        let ordered = mine.sorted { lhs, rhs in
            rank(lhs.role) > rank(rhs.role)
        }
        guard let activeMembership = ordered.first else {
            throw BackendError.noMembership
        }
        let clubId = activeMembership.clubId

        let clubs: [RemoteClub] = try await Backend.client
            .from("clubs")
            .select("id, name, address, country, created_at, subscription_status, trial_ends_at")
            .eq("id", value: clubId.uuidString)
            .execute()
            .value

        guard let remoteClub = clubs.first else {
            throw BackendError.noMembership
        }

        let clubMemberships = memberships.filter { $0.clubId == clubId }
        let memberIds = clubMemberships.map(\.memberId)

        let remoteMembers: [RemoteMember] = memberIds.isEmpty ? [] : try await Backend.client
            .from("members")
            .select("id, first_name, last_name, email, phone, status")
            .in("id", values: memberIds.map(\.uuidString))
            .execute()
            .value

        let bankAccounts: [RemoteBankAccount] = try await Backend.client
            .from("club_bank_accounts")
            .select()
            .eq("club_id", value: clubId.uuidString)
            .execute()
            .value

        let remoteAnnouncements: [RemoteAnnouncement] = try await Backend.client
            .from("announcements")
            .select("id, club_id, created_by_member_id, title, body, is_pinned, published_at, created_at")
            .eq("club_id", value: clubId.uuidString)
            .execute()
            .value

        let remoteEvents: [RemoteEvent] = try await Backend.client
            .from("events")
            .select("id, club_id, title, description, starts_at, location, category")
            .eq("club_id", value: clubId.uuidString)
            .execute()
            .value

        let registrations: [RemoteEventRegistration] = remoteEvents.isEmpty ? [] : try await Backend.client
            .from("event_registrations")
            .select("id, event_id, member_id, status")
            .in("event_id", values: remoteEvents.map(\.id.uuidString))
            .execute()
            .value

        let remoteCalls: [RemotePaymentCall] = try await Backend.client
            .from("payment_calls")
            .select()
            .eq("club_id", value: clubId.uuidString)
            .execute()
            .value

        let remoteItems: [RemotePaymentItem] = try await Backend.client
            .from("payment_call_items")
            .select()
            .eq("club_id", value: clubId.uuidString)
            .execute()
            .value

        // MARK: Mapping

        var club = Club(
            id: remoteClub.id,
            name: remoteClub.name,
            city: remoteClub.address ?? remoteClub.country ?? "",
            createdAt: remoteClub.createdAt,
            renewalDate: remoteClub.trialEndsAt ?? remoteClub.createdAt.addingTimeInterval(365 * 86_400),
            status: .fromRemote(remoteClub.subscriptionStatus),
            seedMemberCount: clubMemberships.count,
            couponCode: nil,
            bank: bankAccounts.first.map(ClubBankAccount.init(remote:))
        )
        club.seedMemberCount = clubMemberships.filter { $0.status == "active" }.count

        let membershipByMember = Dictionary(
            clubMemberships.map { ($0.memberId, $0) },
            uniquingKeysWith: { first, _ in first }
        )

        let members: [Member] = remoteMembers.compactMap { remote in
            guard let membership = membershipByMember[remote.id] else { return nil }
            return Member(
                id: remote.id,
                clubId: clubId,
                firstName: remote.firstName,
                lastName: remote.lastName,
                email: remote.email,
                password: "",
                phone: remote.phone ?? "",
                role: .fromRemote(membership.role),
                isLicensed: !(membership.licenseNumber ?? "").isEmpty,
                licenceNumber: membership.licenseNumber ?? "",
                joinedAt: membership.joinDate,
                isActive: membership.status == "active" && remote.status != "deleted"
            )
        }

        let announcements: [Announcement] = remoteAnnouncements.map { remote in
            Announcement(
                id: remote.id,
                clubId: remote.clubId,
                title: remote.title,
                body: remote.body,
                authorId: remote.createdByMemberId,
                publishedAt: remote.publishedAt ?? remote.createdAt,
                isPinned: remote.isPinned
            )
        }

        let goingByEvent = Dictionary(grouping: registrations.filter { $0.status != "declined" }, by: \.eventId)
        let declinedByEvent = Dictionary(grouping: registrations.filter { $0.status == "declined" }, by: \.eventId)

        let events: [ClubEvent] = remoteEvents.map { remote in
            ClubEvent(
                id: remote.id,
                clubId: remote.clubId,
                title: remote.title,
                kind: .fromRemote(remote.category),
                date: remote.startsAt,
                location: remote.location ?? "",
                details: remote.description ?? "",
                attendeeIds: (goingByEvent[remote.id] ?? []).map(\.memberId),
                declinedIds: (declinedByEvent[remote.id] ?? []).map(\.memberId)
            )
        }

        let itemsByCall = Dictionary(grouping: remoteItems, by: \.paymentCallId)

        let paymentCalls: [PaymentCall] = remoteCalls.map { remote in
            PaymentCall(
                id: remote.id,
                clubId: remote.clubId,
                label: remote.title,
                category: .fromRemote(remote.category),
                amountCents: remote.amountCents,
                dueDate: remote.dueDate,
                createdAt: remote.createdAt,
                createdById: remote.createdByMemberId ?? userId,
                reference: remote.detail,
                notify: true,
                items: (itemsByCall[remote.id] ?? []).map { item in
                    PaymentItem(
                        id: item.id,
                        memberId: item.memberId,
                        isPaid: item.isPaid,
                        paidAt: item.paidAt,
                        remindedAt: item.remindedAt,
                        method: .fromRemote(item.method),
                        declaredAt: item.declaredAt,
                        reference: item.reference,
                        validatedById: item.validatedByMemberId
                    )
                }
            )
        }

        var database = Database()
        database.clubs = [club]
        database.members = members
        database.announcements = announcements
        database.events = events
        database.paymentCalls = paymentCalls

        return Snapshot(database: database, currentMemberId: userId, activeClubId: clubId)
    }

    /// Admin first, then bureau, then plain members.
    private static func rank(_ role: String) -> Int {
        switch role {
        case "admin": 2
        case "board": 1
        default: 0
        }
    }

    // MARK: - Writes

    static func upsertBankAccount(_ account: ClubBankAccount, clubId: UUID, by memberId: UUID?) async throws {
        let payload = BankAccountUpsert(
            clubId: clubId,
            holder: account.holder,
            iban: account.iban,
            bic: account.bic,
            bankName: account.bankName,
            stripeStatus: account.stripeStatus.remoteValue,
            stripeAccountId: account.stripeAccountId,
            acceptsTransfer: account.acceptsTransfer,
            acceptsCash: account.acceptsCash,
            transferNote: account.transferNote,
            cashNote: account.cashNote,
            updatedByMemberId: memberId
        )
        try await Backend.client
            .from("club_bank_accounts")
            .upsert(payload, onConflict: "club_id")
            .execute()
    }

    static func createPaymentCall(_ call: PaymentCall) async throws {
        let callPayload = PaymentCallInsert(
            id: call.id,
            clubId: call.clubId,
            title: call.label,
            detail: call.reference,
            category: call.category.rawValue,
            amountCents: call.amountCents,
            dueDate: call.dueDate,
            createdByMemberId: call.createdById
        )
        try await Backend.client
            .from("payment_calls")
            .insert(callPayload)
            .execute()

        let items = call.items.map { item in
            PaymentItemInsert(
                id: item.id,
                paymentCallId: call.id,
                clubId: call.clubId,
                memberId: item.memberId
            )
        }
        guard !items.isEmpty else { return }
        try await Backend.client
            .from("payment_call_items")
            .insert(items)
            .execute()
    }

    static func declarePayment(itemId: UUID, method: PaymentMethodKind, reference: String?) async throws {
        try await Backend.client
            .rpc("declare_payment", params: DeclarePaymentParams(
                itemId: itemId,
                method: method.remoteValue,
                reference: reference
            ))
            .execute()
    }

    static func validatePayment(itemId: UUID) async throws {
        try await Backend.client
            .rpc("validate_payment", params: PaymentItemIdParams(itemId: itemId))
            .execute()
    }

    static func cancelDeclaration(itemId: UUID) async throws {
        try await Backend.client
            .rpc("cancel_payment_declaration", params: PaymentItemIdParams(itemId: itemId))
            .execute()
    }

    /// The bureau records a payment it received outside the app.
    static func markPaid(itemId: UUID, method: PaymentMethodKind?) async throws {
        try await Backend.client
            .from("payment_call_items")
            .update(PaymentItemPaidUpdate(method: method?.remoteValue))
            .eq("id", value: itemId.uuidString)
            .execute()
    }

    /// Marks the members who have just been chased about an unpaid line.
    static func remind(itemIds: [UUID]) async throws {
        guard !itemIds.isEmpty else { return }
        try await Backend.client
            .from("payment_call_items")
            .update(PaymentItemReminderUpdate(remindedAt: Date()))
            .in("id", values: itemIds.map(\.uuidString))
            .execute()
    }

    static func publishAnnouncement(_ announcement: Announcement) async throws {
        let payload = AnnouncementInsert(
            id: announcement.id,
            clubId: announcement.clubId,
            createdByMemberId: announcement.authorId,
            title: announcement.title,
            body: announcement.body,
            isPinned: announcement.isPinned,
            publishedAt: announcement.publishedAt,
            visibility: "members"
        )
        try await Backend.client
            .from("announcements")
            .insert(payload)
            .execute()
    }

    static func deleteAnnouncement(id: UUID) async throws {
        try await Backend.client
            .from("announcements")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }

    /// Creates the `members` row that mirrors a freshly created auth user.
    static func createSelfMember(
        userId: UUID,
        firstName: String,
        lastName: String,
        email: String,
        phone: String?
    ) async throws {
        let payload = MemberSelfInsert(
            id: userId,
            firstName: firstName,
            lastName: lastName,
            displayName: "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces),
            email: email,
            phone: phone,
            status: "active"
        )
        try await Backend.client
            .from("members")
            .upsert(payload, onConflict: "id")
            .execute()
    }
}

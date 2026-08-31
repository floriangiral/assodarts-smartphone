import Foundation
import SwiftUI

/// Single source of truth for the whole app: authentication, tenant-isolated
/// reads and every mutation. Persisted locally between launches.
@Observable
final class AppStore {
    private static let storageKey = "assodarts.database.v1"
    private static let sessionKey = "assodarts.session.v1"

    var db: Database
    private(set) var currentUserId: UUID?

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.storageKey),
           let decoded = try? JSONDecoder().decode(Database.self, from: data) {
            db = decoded
        } else {
            db = DemoData.seed()
        }
        if let raw = UserDefaults.standard.string(forKey: Self.sessionKey),
           let id = UUID(uuidString: raw),
           db.members.contains(where: { $0.id == id }) {
            currentUserId = id
        }
        save()
    }

    // MARK: - Persistence

    func save() {
        if let data = try? JSONEncoder().encode(db) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
        if let id = currentUserId {
            UserDefaults.standard.set(id.uuidString, forKey: Self.sessionKey)
        } else {
            UserDefaults.standard.removeObject(forKey: Self.sessionKey)
        }
    }

    /// Restores the demo platform to its initial state.
    func resetDemoData() {
        db = DemoData.seed()
        currentUserId = nil
        save()
    }

    // MARK: - Session

    var currentUser: Member? {
        guard let currentUserId else { return nil }
        return db.members.first { $0.id == currentUserId }
    }

    var currentClub: Club? {
        guard let user = currentUser else { return nil }
        return db.clubs.first { $0.id == user.clubId }
    }

    var isDeveloper: Bool { currentUser?.role == .developpeur }

    var canManageClub: Bool { currentUser?.role.canManageClub ?? false }

    /// Returns `nil` on success, otherwise a user-facing error message.
    func signIn(email: String, password: String) -> String? {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let member = db.members.first(where: { $0.email.lowercased() == normalized }) else {
            return tr(
                "Aucun compte ne correspond à cette adresse.",
                "No account matches this email address."
            )
        }
        guard member.password == password else {
            return tr("Mot de passe incorrect.", "Incorrect password.")
        }
        guard member.isActive else {
            return tr(
                "Ce compte a été désactivé par le club.",
                "This account has been deactivated by the club."
            )
        }
        currentUserId = member.id
        save()
        return nil
    }

    func signIn(as member: Member) {
        currentUserId = member.id
        save()
    }

    func signOut() {
        currentUserId = nil
        save()
    }

    // MARK: - Tenant-isolated reads

    func club(_ id: UUID) -> Club? { db.clubs.first { $0.id == id } }

    func member(_ id: UUID) -> Member? { db.members.first { $0.id == id } }

    func memberName(_ id: UUID) -> String { member(id)?.fullName ?? tr("Membre", "Member") }

    func members(of clubId: UUID, includeInactive: Bool = false) -> [Member] {
        db.members
            .filter { $0.clubId == clubId && $0.role != .developpeur && (includeInactive || $0.isActive) }
            .sorted { $0.lastName.localizedCaseInsensitiveCompare($1.lastName) == .orderedAscending }
    }

    func bureauMembers(of clubId: UUID) -> [Member] {
        members(of: clubId).filter { $0.role.canManageClub }
    }

    func memberCount(of club: Club) -> Int {
        max(members(of: club.id).count, club.seedMemberCount)
    }

    func announcements(of clubId: UUID) -> [Announcement] {
        db.announcements
            .filter { $0.clubId == clubId }
            .sorted {
                if $0.isPinned != $1.isPinned { return $0.isPinned && !$1.isPinned }
                return $0.publishedAt > $1.publishedAt
            }
    }

    func events(of clubId: UUID) -> [ClubEvent] {
        db.events.filter { $0.clubId == clubId }.sorted { $0.date < $1.date }
    }

    func upcomingEvents(of clubId: UUID) -> [ClubEvent] {
        events(of: clubId).filter { $0.date >= .now }
    }

    func tournaments(of clubId: UUID) -> [Tournament] {
        db.tournaments.filter { $0.clubId == clubId }.sorted { $0.date > $1.date }
    }

    func paymentCalls(of clubId: UUID) -> [PaymentCall] {
        db.paymentCalls.filter { $0.clubId == clubId }.sorted { $0.createdAt > $1.createdAt }
    }

    /// All payment lines addressed to a member, newest first.
    func payments(for memberId: UUID) -> [(call: PaymentCall, item: PaymentItem)] {
        db.paymentCalls.compactMap { call in
            guard let item = call.item(for: memberId) else { return nil }
            return (call, item)
        }
        .sorted { $0.call.dueDate > $1.call.dueDate }
    }

    func dueCents(for memberId: UUID) -> Int {
        payments(for: memberId)
            .filter { !$0.item.isPaid }
            .reduce(0) { $0 + $1.call.amountCents }
    }

    func isUpToDate(_ memberId: UUID) -> Bool {
        !payments(for: memberId).contains { !$0.item.isPaid && $0.call.category == .cotisation }
    }

    func membershipState(for memberId: UUID) -> PaymentState {
        let unpaid = payments(for: memberId).filter { !$0.item.isPaid && $0.call.category == .cotisation }
        guard let worst = unpaid.first else { return .paid }
        return worst.item.state(dueDate: worst.call.dueDate)
    }

    // MARK: - Conversations

    /// Conversations visible to a user: his own threads, plus every bureau
    /// channel of the club when he belongs to the bureau.
    func conversations(for user: Member) -> [Conversation] {
        db.conversations
            .filter { conversation in
                guard conversation.clubId == user.clubId else { return false }
                if conversation.participantIds.contains(user.id) { return true }
                return conversation.kind == .bureau && user.role.canManageClub
            }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    func unreadCount(for user: Member) -> Int {
        conversations(for: user).reduce(0) { $0 + $1.unreadCount(for: user.id) }
    }

    func conversationTitle(_ conversation: Conversation, viewer: Member) -> String {
        switch conversation.kind {
        case .bureau:
            if viewer.role.canManageClub, let memberId = conversation.participantIds.first {
                return memberName(memberId)
            }
            return tr("Le Bureau", "The Committee")
        case .direct:
            guard let otherId = conversation.counterpartId(for: viewer.id) else {
                return tr("Conversation", "Conversation")
            }
            return memberName(otherId)
        }
    }

    func conversationSubtitle(_ conversation: Conversation, viewer: Member) -> String {
        switch conversation.kind {
        case .bureau:
            if viewer.role.canManageClub {
                return tr("Message adressé au bureau", "Message sent to the committee")
            }
            let count = bureauMembers(of: conversation.clubId).count
            let people = Fmt.count(count, "membre du bureau", "membres du bureau", "committee member", "committee members")
            return "\(club(conversation.clubId)?.name ?? "Club") · \(people)"
        case .direct:
            guard let otherId = conversation.counterpartId(for: viewer.id),
                  let other = member(otherId) else { return "" }
            return other.role.label
        }
    }

    func conversationInitials(_ conversation: Conversation, viewer: Member) -> String {
        switch conversation.kind {
        case .bureau:
            if viewer.role.canManageClub, let memberId = conversation.participantIds.first {
                return member(memberId)?.initials ?? "??"
            }
            return "FB"
        case .direct:
            guard let otherId = conversation.counterpartId(for: viewer.id) else { return "??" }
            return member(otherId)?.initials ?? "??"
        }
    }

    func markRead(_ conversationId: UUID, by memberId: UUID) {
        guard let index = db.conversations.firstIndex(where: { $0.id == conversationId }) else { return }
        var changed = false
        for messageIndex in db.conversations[index].messages.indices
        where !db.conversations[index].messages[messageIndex].readBy.contains(memberId) {
            db.conversations[index].messages[messageIndex].readBy.append(memberId)
            changed = true
        }
        if changed { save() }
    }

    @discardableResult
    func send(text: String, imageData: Data? = nil, in conversationId: UUID, from senderId: UUID) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty || imageData != nil,
              let index = db.conversations.firstIndex(where: { $0.id == conversationId }) else { return false }
        let message = Message(senderId: senderId, text: trimmed, readBy: [senderId], imageData: imageData)
        db.conversations[index].messages.append(message)
        save()
        return true
    }

    /// Finds (or opens) the bureau channel of a member.
    func bureauChannel(for memberId: UUID, clubId: UUID) -> Conversation {
        if let existing = db.conversations.first(where: {
            $0.clubId == clubId && $0.kind == .bureau && $0.participantIds == [memberId]
        }) {
            return existing
        }
        let conversation = Conversation(clubId: clubId, kind: .bureau, participantIds: [memberId])
        db.conversations.append(conversation)
        save()
        return conversation
    }

    /// Finds (or opens) a one-to-one thread between two people of the same club.
    func directConversation(between a: UUID, and b: UUID, clubId: UUID) -> Conversation {
        if let existing = db.conversations.first(where: {
            $0.clubId == clubId && $0.kind == .direct && Set($0.participantIds) == Set([a, b])
        }) {
            return existing
        }
        let conversation = Conversation(clubId: clubId, kind: .direct, participantIds: [a, b])
        db.conversations.append(conversation)
        save()
        return conversation
    }

    // MARK: - Club mutations

    func publishAnnouncement(title: String, body: String, pinned: Bool, author: Member) {
        let announcement = Announcement(
            clubId: author.clubId,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            body: body.trimmingCharacters(in: .whitespacesAndNewlines),
            authorId: author.id,
            isPinned: pinned
        )
        db.announcements.insert(announcement, at: 0)
        save()
    }

    func deleteAnnouncement(_ id: UUID) {
        db.announcements.removeAll { $0.id == id }
        save()
    }

    func setAttendance(_ going: Bool?, eventId: UUID, memberId: UUID) {
        guard let index = db.events.firstIndex(where: { $0.id == eventId }) else { return }
        db.events[index].attendeeIds.removeAll { $0 == memberId }
        db.events[index].declinedIds.removeAll { $0 == memberId }
        if going == true { db.events[index].attendeeIds.append(memberId) }
        if going == false { db.events[index].declinedIds.append(memberId) }
        save()
    }

    func addEvent(_ event: ClubEvent) {
        db.events.append(event)
        save()
    }

    func updateMember(_ member: Member) {
        guard let index = db.members.firstIndex(where: { $0.id == member.id }) else { return }
        db.members[index] = member
        save()
    }

    func addMember(_ member: Member) {
        db.members.append(member)
        save()
    }

    func addTournament(_ tournament: Tournament) {
        db.tournaments.append(tournament)
        save()
    }

    func addEntry(_ entry: TournamentEntry, to tournamentId: UUID) {
        guard let index = db.tournaments.firstIndex(where: { $0.id == tournamentId }) else { return }
        db.tournaments[index].entries.append(entry)
        save()
    }

    func deleteEntry(_ entryId: UUID, from tournamentId: UUID) {
        guard let index = db.tournaments.firstIndex(where: { $0.id == tournamentId }) else { return }
        db.tournaments[index].entries.removeAll { $0.id == entryId }
        save()
    }

    // MARK: - Payments

    func createPaymentCall(_ call: PaymentCall) {
        db.paymentCalls.insert(call, at: 0)
        save()
    }

    func markPaid(callId: UUID, memberId: UUID) {
        guard let callIndex = db.paymentCalls.firstIndex(where: { $0.id == callId }),
              let itemIndex = db.paymentCalls[callIndex].items.firstIndex(where: { $0.memberId == memberId })
        else { return }
        db.paymentCalls[callIndex].items[itemIndex].isPaid = true
        db.paymentCalls[callIndex].items[itemIndex].paidAt = .now
        save()
    }

    func remind(callId: UUID, memberIds: [UUID]) {
        guard let callIndex = db.paymentCalls.firstIndex(where: { $0.id == callId }) else { return }
        for itemIndex in db.paymentCalls[callIndex].items.indices
        where memberIds.contains(db.paymentCalls[callIndex].items[itemIndex].memberId)
            && !db.paymentCalls[callIndex].items[itemIndex].isPaid {
            db.paymentCalls[callIndex].items[itemIndex].remindedAt = .now
        }
        save()
    }

    func paymentCall(_ id: UUID) -> PaymentCall? {
        db.paymentCalls.first { $0.id == id }
    }

    // MARK: - Club subscription

    func tier(for club: Club) -> PricingTier {
        PricingTier.tier(forMemberCount: memberCount(of: club))
    }

    func coupon(for club: Club) -> Coupon? {
        guard let code = club.couponCode else { return nil }
        return db.coupons.first { $0.code == code && $0.clubIds.contains(club.id) && !$0.isExpired }
    }

    func annualPriceCents(for club: Club) -> Int {
        let tier = tier(for: club)
        guard tier.priceEuros > 0 else { return 0 }
        if let coupon = coupon(for: club) {
            return coupon.discountedCents(fromEuros: tier.priceEuros)
        }
        return tier.priceEuros * 100
    }

    // MARK: - Developer console

    var platformClubs: [Club] {
        db.clubs.filter { $0.name != "Assodarts" }
    }

    var totalClubs: Int { platformClubs.count }

    var totalMembers: Int {
        platformClubs.reduce(0) { $0 + memberCount(of: $1) }
    }

    var trialClubs: Int { platformClubs.filter { $0.status == .trial }.count }

    var annualRevenueCents: Int {
        platformClubs
            .filter { $0.status == .active || $0.status == .grace }
            .reduce(0) { $0 + annualPriceCents(for: $1) }
    }

    var grantedDiscountCents: Int {
        platformClubs.reduce(0) { total, club in
            guard let coupon = coupon(for: club) else { return total }
            let full = tier(for: club).priceEuros * 100
            return total + (full - coupon.discountedCents(fromEuros: tier(for: club).priceEuros))
        }
    }

    /// Number of clubs created per month over the last 12 months.
    var clubsPerMonth: [(label: String, count: Int)] {
        let calendar = Calendar.current
        return (0..<12).reversed().compactMap { offset in
            guard let date = calendar.date(byAdding: .month, value: -offset, to: .now) else { return nil }
            let month = calendar.component(.month, from: date)
            let year = calendar.component(.year, from: date)
            let count = platformClubs.filter {
                calendar.component(.month, from: $0.createdAt) == month
                    && calendar.component(.year, from: $0.createdAt) == year
            }.count
            let label = date.formatted(.dateTime.locale(Fmt.locale).month(.narrow))
            return (label, count)
        }
    }

    /// Revenue split by pricing tier, for the developer finances screen.
    var revenueByTier: [(tier: PricingTier, clubs: Int, cents: Int)] {
        PricingTier.all.compactMap { tier in
            let clubs = platformClubs.filter { self.tier(for: $0).id == tier.id }
            guard !clubs.isEmpty else { return nil }
            let cents = clubs
                .filter { $0.status == .active || $0.status == .grace }
                .reduce(0) { $0 + annualPriceCents(for: $1) }
            return (tier, clubs.count, cents)
        }
    }

    func clubsUsing(_ coupon: Coupon) -> [Club] {
        db.clubs.filter { coupon.clubIds.contains($0.id) }
    }

    func createCoupon(_ coupon: Coupon) {
        db.coupons.insert(coupon, at: 0)
        for clubId in coupon.clubIds {
            guard let index = db.clubs.firstIndex(where: { $0.id == clubId }) else { continue }
            db.clubs[index].couponCode = coupon.code
        }
        save()
    }

    func deleteCoupon(_ id: UUID) {
        guard let coupon = db.coupons.first(where: { $0.id == id }) else { return }
        for clubId in coupon.clubIds {
            guard let index = db.clubs.firstIndex(where: { $0.id == clubId }) else { continue }
            if db.clubs[index].couponCode == coupon.code { db.clubs[index].couponCode = nil }
        }
        db.coupons.removeAll { $0.id == id }
        save()
    }

    func broadcast(title: String, body: String, audience: BroadcastAudience) {
        let announcement = PlatformAnnouncement(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            body: body.trimmingCharacters(in: .whitespacesAndNewlines),
            audience: audience
        )
        db.platformAnnouncements.insert(announcement, at: 0)
        save()
    }

    var platformAnnouncements: [PlatformAnnouncement] {
        db.platformAnnouncements.sorted { $0.publishedAt > $1.publishedAt }
    }

    /// Platform announcements a given user is allowed to see.
    func visiblePlatformAnnouncements(for user: Member) -> [PlatformAnnouncement] {
        platformAnnouncements.filter { $0.audience == .all || user.role.canManageClub }
    }

    var broadcastRecipients: Int {
        platformClubs.reduce(0) { $0 + max(2, memberCount(of: $1) / 12) }
    }
}

import FirebaseFirestore
import FirebaseFunctions
import Foundation

/// Reads and writes the live club data.
///
/// Every query relies on Firestore Security Rules for tenant isolation: the
/// rules only ever return documents of the clubs the signed-in member
/// actually belongs to, so no `clubId` filter is duplicated here as a
/// security measure — it is only here to shape the query itself.
enum RemoteRepository {
    /// A club the signed-in member belongs to, for the active-club switcher.
    struct AvailableClub: Identifiable, Hashable, Sendable {
        let id: String
        let name: String
    }

    /// Everything the app needs for one signed-in member, already mapped onto
    /// the local models so the whole UI keeps working unchanged.
    struct Snapshot: Sendable {
        var database: Database
        var currentMemberId: UUID
        var activeClubId: UUID
        /// The real Firestore club id backing `activeClubId`, needed to
        /// persist the active-club selection and to switch clubs later.
        var activeClubRemoteId: String
        /// Every club the member has an active membership in.
        var availableClubs: [AvailableClub]
    }

    // MARK: - Loading

    /// Firebase Auth UIDs are opaque strings; app data keeps UUID member IDs.
    /// Resolve the profile link rather than trying to parse an Auth UID as UUID.
    static func memberId(forAuthUid authUid: String) async throws -> UUID? {
        let snapshot = try await Backend.firestore.collection("members")
            .whereField("authUid", isEqualTo: authUid)
            .limit(to: 1)
            .getDocuments()
        guard let document = snapshot.documents.first else { return nil }
        return UUID(uuidString: document.documentID)
    }

    /// - Parameter preferredClubId: The club to make active, when the member
    ///   belongs to several. Falls back to the member's stored
    ///   `defaultClubId`, then to the club they hold the highest role in.
    static func loadSnapshot(for userId: UUID, preferredClubId: String? = nil) async throws -> Snapshot {
        let db = Backend.firestore

        let mineSnap = try await db.collection("memberships")
            .whereField("memberId", isEqualTo: userId.uuidString)
            .whereField("status", isEqualTo: "active")
            .getDocuments()
        let mine = mineSnap.documents.compactMap { try? $0.data(as: RemoteMembership.self) }
        guard !mine.isEmpty else { throw BackendError.noMembership }

        let membershipClubIds = Set(mine.map(\.clubId))
        let storedDefaultClubId = try? (await db.collection("members").document(userId.uuidString).getDocument())
            .data(as: RemoteMember.self).defaultClubId

        let clubId: String
        if let preferredClubId, membershipClubIds.contains(preferredClubId) {
            clubId = preferredClubId
        } else if let storedDefaultClubId, membershipClubIds.contains(storedDefaultClubId) {
            clubId = storedDefaultClubId
        } else {
            // Admins and bureau land on the club they manage first.
            let ordered = mine.sorted { rank($0.role) > rank($1.role) }
            clubId = ordered[0].clubId
        }

        guard let remoteClub = try? (await db.collection("clubs").document(clubId).getDocument())
            .data(as: RemoteClub.self)
        else {
            throw BackendError.noMembership
        }

        let clubMembershipsSnap = try await db.collection("memberships")
            .whereField("clubId", isEqualTo: clubId)
            .getDocuments()
        let clubMemberships = clubMembershipsSnap.documents.compactMap {
            try? $0.data(as: RemoteMembership.self)
        }
        let memberIds = clubMemberships.map(\.memberId)

        let remoteMembers = try await loadMembers(ids: memberIds, in: db)

        let bankAccount = try? (await db.collection("club_bank_accounts").document(clubId).getDocument())
            .data(as: RemoteBankAccount.self)

        let announcementsSnap = try await db.collection("announcements")
            .whereField("clubId", isEqualTo: clubId)
            .getDocuments()
        let remoteAnnouncements = announcementsSnap.documents.compactMap {
            try? $0.data(as: RemoteAnnouncement.self)
        }

        let eventsSnap = try await db.collection("events")
            .whereField("clubId", isEqualTo: clubId)
            .getDocuments()
        let remoteEvents = eventsSnap.documents.compactMap { try? $0.data(as: RemoteEvent.self) }

        let registrationsSnap = try await db.collection("event_registrations")
            .whereField("clubId", isEqualTo: clubId)
            .getDocuments()
        let registrations = registrationsSnap.documents.compactMap {
            try? $0.data(as: RemoteEventRegistration.self)
        }

        let callsSnap = try await db.collection("payment_calls")
            .whereField("clubId", isEqualTo: clubId)
            .getDocuments()
        let remoteCalls = callsSnap.documents.compactMap { try? $0.data(as: RemotePaymentCall.self) }

        let itemsSnap = try await db.collection("payment_call_items")
            .whereField("clubId", isEqualTo: clubId)
            .getDocuments()
        let remoteItems = itemsSnap.documents.compactMap { try? $0.data(as: RemotePaymentItem.self) }

        let tournamentsSnap = try await db.collection("tournaments")
            .whereField("clubId", isEqualTo: clubId)
            .getDocuments()
        let remoteTournaments = tournamentsSnap.documents.compactMap { try? $0.data(as: RemoteTournament.self) }

        let tournamentEntriesSnap = try await db.collection("tournament_entries")
            .whereField("clubId", isEqualTo: clubId)
            .getDocuments()
        let remoteTournamentEntries = tournamentEntriesSnap.documents.compactMap {
            try? $0.data(as: RemoteTournamentEntry.self)
        }

        let conversationsSnap = try await db.collection("conversations")
            .whereField("clubId", isEqualTo: clubId)
            .getDocuments()
        let remoteConversations = conversationsSnap.documents.compactMap {
            try? $0.data(as: RemoteConversation.self)
        }
        var messagesByConversation: [String: [RemoteMessage]] = [:]
        for conversation in remoteConversations {
            guard let conversationId = conversation.id else { continue }
            let messagesSnap = try await db.collection("conversations").document(conversationId)
                .collection("messages")
                .order(by: "sentAt")
                .getDocuments()
            messagesByConversation[conversationId] = messagesSnap.documents.compactMap {
                try? $0.data(as: RemoteMessage.self)
            }
        }

        // MARK: Mapping

        let clubUUID = remoteId(clubId)

        var club = Club(
            id: clubUUID,
            name: remoteClub.name,
            city: remoteClub.address ?? remoteClub.country ?? "",
            createdAt: remoteClub.createdAt,
            renewalDate: remoteClub.trialEndsAt ?? remoteClub.createdAt.addingTimeInterval(365 * 86_400),
            status: .fromRemote(remoteClub.subscriptionStatus),
            seedMemberCount: clubMemberships.count,
            couponCode: nil,
            bank: bankAccount.map(ClubBankAccount.init(remote:))
        )
        club.seedMemberCount = clubMemberships.filter { $0.status == "active" }.count

        let membershipByMember = Dictionary(
            clubMemberships.map { (remoteId($0.memberId), $0) },
            uniquingKeysWith: { first, _ in first }
        )

        let members: [Member] = remoteMembers.compactMap { remote in
            guard let id = remote.id else { return nil }
            let memberId = remoteId(id)
            guard let membership = membershipByMember[memberId] else { return nil }
            return Member(
                id: memberId,
                clubId: clubUUID,
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
                id: remoteId(remote.id),
                clubId: clubUUID,
                title: remote.title,
                body: remote.body,
                authorId: remoteId(remote.createdByMemberId),
                publishedAt: remote.publishedAt ?? remote.createdAt,
                isPinned: remote.isPinned
            )
        }

        let goingByEvent = Dictionary(
            grouping: registrations.filter { $0.status != "declined" },
            by: \.eventId
        )
        let declinedByEvent = Dictionary(
            grouping: registrations.filter { $0.status == "declined" },
            by: \.eventId
        )

        let events: [ClubEvent] = remoteEvents.map { remote in
            let eventId = remote.id ?? ""
            return ClubEvent(
                id: remoteId(remote.id),
                clubId: clubUUID,
                title: remote.title,
                kind: .fromRemote(remote.category),
                date: remote.startsAt,
                location: remote.location ?? "",
                details: remote.description ?? "",
                attendeeIds: (goingByEvent[eventId] ?? []).map { remoteId($0.memberId) },
                declinedIds: (declinedByEvent[eventId] ?? []).map { remoteId($0.memberId) }
            )
        }

        let itemsByCall = Dictionary(grouping: remoteItems, by: \.paymentCallId)

        let paymentCalls: [PaymentCall] = remoteCalls.map { remote in
            let callId = remote.id ?? ""
            return PaymentCall(
                id: remoteId(remote.id),
                clubId: clubUUID,
                label: remote.title,
                category: .fromRemote(remote.category),
                amountCents: remote.amountCents,
                dueDate: remote.dueDate,
                createdAt: remote.createdAt,
                createdById: remote.createdByMemberId.map(remoteId) ?? userId,
                reference: remote.detail,
                notify: true,
                items: (itemsByCall[callId] ?? []).map { item in
                    PaymentItem(
                        id: remoteId(item.id),
                        memberId: remoteId(item.memberId),
                        isPaid: item.isPaid,
                        paidAt: item.paidAt,
                        remindedAt: item.remindedAt,
                        method: .fromRemote(item.method),
                        declaredAt: item.declaredAt,
                        reference: item.reference,
                        validatedById: item.validatedByMemberId.map(remoteId)
                    )
                }
            )
        }

        let entriesByTournament = Dictionary(grouping: remoteTournamentEntries, by: \.tournamentId)
        let tournaments: [Tournament] = remoteTournaments.map { remote in
            let tournamentId = remote.id ?? ""
            return Tournament(
                id: remoteId(remote.id),
                clubId: clubUUID,
                name: remote.name,
                date: remote.date,
                location: remote.location,
                markerIds: remote.markerIds.map(remoteId),
                entries: (entriesByTournament[tournamentId] ?? []).map { entry in
                    TournamentEntry(
                        id: remoteId(entry.id),
                        tableau: entry.tableau,
                        tour: entry.tour,
                        playerA: entry.playerA,
                        playerB: entry.playerB,
                        scoreA: entry.scoreA,
                        scoreB: entry.scoreB,
                        note: entry.note,
                        recordedById: remoteId(entry.recordedByMemberId),
                        recordedAt: entry.recordedAt
                    )
                },
                isFinished: remote.isFinished
            )
        }

        let conversations: [Conversation] = remoteConversations.compactMap { remote in
            guard let conversationId = remote.id,
                  let kind = ConversationKind(rawValue: remote.kind) else { return nil }
            return Conversation(
                id: remoteId(conversationId),
                clubId: clubUUID,
                kind: kind,
                participantIds: remote.participantIds.map(remoteId),
                messages: (messagesByConversation[conversationId] ?? []).map { message in
                    Message(
                        id: remoteId(message.id),
                        senderId: remoteId(message.senderId),
                        text: message.text,
                        sentAt: message.sentAt,
                        readBy: message.readBy.map(remoteId)
                    )
                }
            )
        }

        var database = Database()
        database.clubs = [club]
        database.members = members
        database.announcements = announcements
        database.events = events
        database.tournaments = tournaments
        database.paymentCalls = paymentCalls
        database.conversations = conversations

        let availableClubs = try await loadAvailableClubs(clubIds: membershipClubIds, activeClub: remoteClub, activeClubId: clubId, in: db)

        return Snapshot(
            database: database,
            currentMemberId: userId,
            activeClubId: clubUUID,
            activeClubRemoteId: clubId,
            availableClubs: availableClubs
        )
    }

    /// Admin first, then bureau, then plain members.
    private static func rank(_ role: String) -> Int {
        switch role {
        case "admin": 2
        case "board": 1
        default: 0
        }
    }

    /// Names of every club the member belongs to, for the active-club switcher.
    private static func loadAvailableClubs(
        clubIds: Set<String>,
        activeClub: RemoteClub,
        activeClubId: String,
        in db: Firestore
    ) async throws -> [AvailableClub] {
        var result = [AvailableClub(id: activeClubId, name: activeClub.name)]
        let otherIds = Array(clubIds.subtracting([activeClubId]))
        guard !otherIds.isEmpty else { return result }

        for chunk in stride(from: 0, to: otherIds.count, by: 30).map({ Array(otherIds[$0..<min($0 + 30, otherIds.count)]) }) {
            let snap = try await db.collection("clubs")
                .whereField(FieldPath.documentID(), in: chunk)
                .getDocuments()
            result.append(contentsOf: snap.documents.compactMap { doc in
                (doc.data()["name"] as? String).map { AvailableClub(id: doc.documentID, name: $0) }
            })
        }
        return result.sorted { $0.name < $1.name }
    }

    /// Firestore's `in` operator caps at 30 values per query.
    private static func loadMembers(ids: [String], in db: Firestore) async throws -> [RemoteMember] {
        guard !ids.isEmpty else { return [] }
        var results: [RemoteMember] = []
        for chunk in stride(from: 0, to: ids.count, by: 30).map({ Array(ids[$0..<min($0 + 30, ids.count)]) }) {
            let snap = try await db.collection("members")
                .whereField(FieldPath.documentID(), in: chunk)
                .getDocuments()
            results.append(contentsOf: snap.documents.compactMap { try? $0.data(as: RemoteMember.self) })
        }
        return results
    }

    // MARK: - Writes

    /// Persists the member's active-club choice. Security rules only accept
    /// clubs the member holds an active membership for.
    static func setDefaultClub(memberId: UUID, clubId: String) async throws {
        try await Backend.firestore.collection("members").document(memberId.uuidString)
            .setData(["clubId": clubId, "defaultClubId": clubId], merge: true)
    }

    static func upsertBankAccount(_ account: ClubBankAccount, clubId: UUID, by memberId: UUID?) async throws {
        let payload = BankAccountUpsert(
            clubId: clubId.uuidString,
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
            updatedByMemberId: memberId?.uuidString
        )
        try Backend.firestore
            .collection("club_bank_accounts")
            .document(clubId.uuidString)
            .setData(from: payload, merge: true)
    }

    static func createPaymentCall(_ call: PaymentCall) async throws {
        let batch = Backend.firestore.batch()

        let callPayload = PaymentCallInsert(
            clubId: call.clubId.uuidString,
            title: call.label,
            detail: call.reference,
            category: call.category.rawValue,
            amountCents: call.amountCents,
            currency: "eur",
            dueDate: call.dueDate,
            createdByMemberId: call.createdById.uuidString,
            createdAt: call.createdAt
        )
        let callRef = Backend.firestore.collection("payment_calls").document(call.id.uuidString)
        try batch.setData(from: callPayload, forDocument: callRef)

        for item in call.items {
            let itemPayload = PaymentItemInsert(
                paymentCallId: call.id.uuidString,
                clubId: call.clubId.uuidString,
                memberId: item.memberId.uuidString,
                isPaid: false
            )
            let itemRef = Backend.firestore.collection("payment_call_items").document(item.id.uuidString)
            try batch.setData(from: itemPayload, forDocument: itemRef)
        }

        try await batch.commit()
    }

    static func declarePayment(itemId: UUID, method: PaymentMethodKind, reference: String?) async throws {
        _ = try await Backend.functions.httpsCallable("declarePayment").call([
            "itemId": itemId.uuidString,
            "method": method.remoteValue,
            "reference": reference as Any,
        ])
    }

    static func validatePayment(itemId: UUID) async throws {
        _ = try await Backend.functions.httpsCallable("validatePayment").call(["itemId": itemId.uuidString])
    }

    static func cancelDeclaration(itemId: UUID) async throws {
        _ = try await Backend.functions.httpsCallable("cancelPaymentDeclaration").call([
            "itemId": itemId.uuidString,
        ])
    }

    /// The bureau records a payment it received outside the app.
    static func markPaid(itemId: UUID, method: PaymentMethodKind?) async throws {
        try await Backend.firestore.collection("payment_call_items").document(itemId.uuidString).updateData([
            "isPaid": true,
            "paidAt": FieldValue.serverTimestamp(),
            "method": method?.remoteValue as Any,
            "declaredAt": NSNull(),
            "updatedAt": FieldValue.serverTimestamp(),
        ])
    }

    /// Marks the members who have just been chased about an unpaid line.
    static func remind(itemIds: [UUID]) async throws {
        guard !itemIds.isEmpty else { return }
        let batch = Backend.firestore.batch()
        for itemId in itemIds {
            let ref = Backend.firestore.collection("payment_call_items").document(itemId.uuidString)
            batch.updateData([
                "remindedAt": FieldValue.serverTimestamp(),
                "updatedAt": FieldValue.serverTimestamp(),
            ], forDocument: ref)
        }
        try await batch.commit()
    }

    static func publishAnnouncement(_ announcement: Announcement) async throws {
        let payload = AnnouncementInsert(
            clubId: announcement.clubId.uuidString,
            createdByMemberId: announcement.authorId.uuidString,
            title: announcement.title,
            body: announcement.body,
            isPinned: announcement.isPinned,
            publishedAt: announcement.publishedAt,
            visibility: "members",
            createdAt: .now
        )
        try Backend.firestore
            .collection("announcements")
            .document(announcement.id.uuidString)
            .setData(from: payload)
    }

    static func deleteAnnouncement(id: UUID) async throws {
        try await Backend.firestore.collection("announcements").document(id.uuidString).delete()
    }

    static func createEvent(_ event: ClubEvent) async throws {
        let payload = EventInsert(
            clubId: event.clubId.uuidString,
            title: event.title,
            description: event.details,
            startsAt: event.date,
            location: event.location,
            category: event.kind.remoteValue
        )
        try Backend.firestore.collection("events").document(event.id.uuidString).setData(from: payload)
    }

    static func setEventAttendance(_ response: Bool?, eventId: UUID, clubId: UUID, memberId: UUID) async throws {
        let registration = Backend.firestore.collection("event_registrations")
            .document("\(eventId.uuidString)_\(memberId.uuidString)")
        guard let response else {
            try await registration.delete()
            return
        }
        let payload = EventRegistrationInsert(
            clubId: clubId.uuidString,
            eventId: eventId.uuidString,
            memberId: memberId.uuidString,
            status: response ? "going" : "declined"
        )
        try registration.setData(from: payload)
    }

    static func createTournament(_ tournament: Tournament) async throws {
        let payload = TournamentInsert(
            clubId: tournament.clubId.uuidString,
            name: tournament.name,
            date: tournament.date,
            location: tournament.location,
            markerIds: tournament.markerIds.map(\.uuidString),
            isFinished: tournament.isFinished
        )
        try Backend.firestore.collection("tournaments").document(tournament.id.uuidString).setData(from: payload)
    }

    static func addTournamentEntry(_ entry: TournamentEntry, tournamentId: UUID, clubId: UUID) async throws {
        let payload = TournamentEntryInsert(
            clubId: clubId.uuidString,
            tournamentId: tournamentId.uuidString,
            tableau: entry.tableau,
            tour: entry.tour,
            playerA: entry.playerA,
            playerB: entry.playerB,
            scoreA: entry.scoreA,
            scoreB: entry.scoreB,
            note: entry.note,
            recordedByMemberId: entry.recordedById.uuidString,
            recordedAt: entry.recordedAt
        )
        try Backend.firestore.collection("tournament_entries").document(entry.id.uuidString).setData(from: payload)
    }

    static func deleteTournamentEntry(id: UUID) async throws {
        try await Backend.firestore.collection("tournament_entries").document(id.uuidString).delete()
    }

    static func createConversation(_ conversation: Conversation) async throws {
        let payload = ConversationInsert(
            clubId: conversation.clubId.uuidString,
            kind: conversation.kind.rawValue,
            participantIds: conversation.participantIds.map(\.uuidString)
        )
        try Backend.firestore.collection("conversations").document(conversation.id.uuidString).setData(from: payload)
    }

    static func sendMessage(_ message: Message, conversationId: UUID) async throws {
        let payload = MessageInsert(
            senderId: message.senderId.uuidString,
            text: message.text,
            sentAt: message.sentAt,
            readBy: message.readBy.map(\.uuidString)
        )
        try Backend.firestore.collection("conversations").document(conversationId.uuidString)
            .collection("messages").document(message.id.uuidString).setData(from: payload)
    }

    static func markConversationRead(conversationId: UUID, messageIds: [UUID], by memberId: UUID) async throws {
        let batch = Backend.firestore.batch()
        for messageId in messageIds {
            let ref = Backend.firestore.collection("conversations").document(conversationId.uuidString)
                .collection("messages").document(messageId.uuidString)
            batch.updateData(["readBy": FieldValue.arrayUnion([memberId.uuidString])], forDocument: ref)
        }
        try await batch.commit()
    }

    /// Creates the `members` document that mirrors a freshly created auth
    /// user. `clubId` starts `nil`: the board links it to a club membership
    /// once the invite flow assigns one.
    static func createSelfMember(
        userId: UUID,
        authUid: String,
        firstName: String,
        lastName: String,
        email: String,
        phone: String?
    ) async throws {
        let payload = MemberSelfInsert(
            authUid: authUid,
            clubId: nil,
            firstName: firstName,
            lastName: lastName,
            displayName: "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces),
            email: email,
            phone: phone,
            status: "active"
        )
        try Backend.firestore
            .collection("members")
            .document(userId.uuidString)
            .setData(from: payload, merge: true)
    }

    // MARK: - Invitations

    /// The board invites someone by email; the membership is only created once
    /// that person signs up or signs in with the same address.
    static func inviteMember(clubId: UUID, email: String, role: Role, licenseNumber: String?) async throws {
        _ = try await Backend.functions.httpsCallable("createInvitation").call([
            "clubId": clubId.uuidString,
            "email": email,
            "role": role.remoteValue,
            "licenseNumber": licenseNumber as Any,
        ])
    }

    /// The board withdraws a pending invitation before it is accepted.
    static func revokeInvitation(clubId: UUID, email: String) async throws {
        _ = try await Backend.functions.httpsCallable("revokeInvitation").call([
            "clubId": clubId.uuidString,
            "email": email,
        ])
    }

    /// Joins every club that invited the signed-in member's email, if any.
    /// Called right after sign-in/sign-up, before the first snapshot load.
    /// - Returns: The real Firestore id of the first club joined, if any.
    @discardableResult
    static func acceptPendingInvitation() async throws -> String? {
        let result = try await Backend.functions.httpsCallable("acceptInvitation").call([String: Any]())
        guard let data = result.data as? [String: Any] else { return nil }
        return data["joinedClubId"] as? String
    }
}

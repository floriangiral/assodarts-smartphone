import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions
import FirebaseStorage
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

    private static func encodedData<T: Encodable>(from payload: T) throws -> [String: Any] {
        try Firestore.Encoder().encode(payload)
    }

    private static func loadProfilePhoto(path: String?) async -> Data? {
        guard let path, !path.isEmpty else { return nil }
        do {
            return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data?, Error>) in
                Backend.storage.reference().child(path).getData(maxSize: 2 * 1024 * 1024) { data, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: data)
                    }
                }
            }
        } catch {
            return nil
        }
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
        /// Reverse lookup for local UUIDs derived from non-UUID Firestore ids.
        var remoteIdsByLocalId: [UUID: String]
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
        guard let authUid = Backend.auth.currentUser?.uid else { throw BackendError.noMembership }

        let mineSnap = try await db.collection("memberships")
            .whereField("memberId", isEqualTo: userId.uuidString)
            .whereField("authUid", isEqualTo: authUid)
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

        let selectedMembership = mine.first { $0.clubId == clubId }
        let canReadAllPaymentItems = selectedMembership.map { rank($0.role) > 0 } ?? false
        var paymentItemsQuery: Query = db.collection("payment_call_items")
            .whereField("clubId", isEqualTo: clubId)
        if !canReadAllPaymentItems {
            paymentItemsQuery = paymentItemsQuery.whereField("memberId", isEqualTo: userId.uuidString)
        }
        let itemsSnap = try await paymentItemsQuery.getDocuments()
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

        let remoteConversations = try await loadConversations(
            clubId: clubId,
            memberId: userId.uuidString,
            canReadBureauInbox: selectedMembership.map { rank($0.role) > 0 } ?? false,
            in: db
        )
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
        var remoteIdsByLocalId: [UUID: String] = [:]
        func rememberRemoteId(_ raw: String?) {
            guard let raw, !raw.isEmpty else { return }
            remoteIdsByLocalId[remoteId(raw)] = raw
        }

        rememberRemoteId(clubId)
        memberIds.forEach { rememberRemoteId($0) }
        remoteAnnouncements.forEach {
            rememberRemoteId($0.id)
            rememberRemoteId($0.createdByMemberId)
        }
        remoteEvents.forEach { rememberRemoteId($0.id) }
        registrations.forEach {
            rememberRemoteId($0.id)
            rememberRemoteId($0.eventId)
            rememberRemoteId($0.memberId)
        }
        remoteCalls.forEach {
            rememberRemoteId($0.id)
            rememberRemoteId($0.createdByMemberId)
        }
        remoteItems.forEach {
            rememberRemoteId($0.id)
            rememberRemoteId($0.paymentCallId)
            rememberRemoteId($0.memberId)
        }
        remoteTournaments.forEach {
            rememberRemoteId($0.id)
            $0.markerIds.forEach { rememberRemoteId($0) }
        }
        remoteTournamentEntries.forEach {
            rememberRemoteId($0.id)
            rememberRemoteId($0.tournamentId)
            rememberRemoteId($0.recordedByMemberId)
        }
        remoteConversations.forEach {
            rememberRemoteId($0.id)
            $0.participantIds.forEach { rememberRemoteId($0) }
        }
        messagesByConversation.values.flatMap { $0 }.forEach {
            rememberRemoteId($0.id)
            rememberRemoteId($0.senderId)
            $0.readBy.forEach { rememberRemoteId($0) }
        }

        var club = Club(
            id: clubUUID,
            name: remoteClub.name,
            city: remoteClub.address ?? remoteClub.country ?? "",
            createdAt: remoteClub.createdAt,
            // Once the club pays, Stripe's period end is the real renewal date;
            // before that it is the end of the free trial.
            renewalDate: remoteClub.currentPeriodEnd
                ?? remoteClub.trialEndsAt
                ?? remoteClub.createdAt.addingTimeInterval(365 * 86_400),
            status: .fromRemote(remoteClub.subscriptionStatus),
            seedMemberCount: clubMemberships.count,
            couponCode: remoteClub.couponCode,
            stripeCustomerId: remoteClub.stripeCustomerId,
            stripeSubscriptionId: remoteClub.stripeSubscriptionId,
            bank: bankAccount.map(ClubBankAccount.init(remote:))
        )
        club.seedMemberCount = clubMemberships.filter { $0.status == "active" }.count

        let membershipByMember = Dictionary(
            clubMemberships.map { (remoteId($0.memberId), $0) },
            uniquingKeysWith: { first, _ in first }
        )

        var members: [Member] = []
        for remote in remoteMembers {
            guard let id = remote.id else { continue }
            let memberId = remoteId(id)
            guard let membership = membershipByMember[memberId] else { continue }
            let photoData = await loadProfilePhoto(path: remote.photoPath)
            members.append(Member(
                id: memberId,
                clubId: clubUUID,
                firstName: remote.firstName,
                lastName: remote.lastName,
                email: remote.email,
                password: "",
                phone: remote.phone ?? "",
                birthDate: remote.birthDate,
                role: .fromRemote(membership.role),
                isLicensed: !(membership.licenseNumber ?? "").isEmpty,
                licenceNumber: membership.licenseNumber ?? "",
                joinedAt: membership.joinDate,
                isActive: membership.status == "active" && remote.status != "deleted",
                photoData: photoData,
                photoPath: remote.photoPath,
                notifyAnnouncements: remote.notifyAnnouncements ?? true,
                notifyEvents: remote.notifyEvents ?? true,
                notifyPayments: remote.notifyPayments ?? true,
                notifyTournaments: remote.notifyTournaments ?? false
            ))
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
                notify: remote.notify ?? true,
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
            availableClubs: availableClubs,
            remoteIdsByLocalId: remoteIdsByLocalId
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

        for clubId in otherIds {
            let doc = try await db.collection("clubs").document(clubId).getDocument()
            if let name = doc.data()?["name"] as? String {
                result.append(AvailableClub(id: doc.documentID, name: name))
            }
        }
        return result.sorted { $0.name < $1.name }
    }

    /// Use direct document reads so Firestore rules can evaluate each member's
    /// `clubId`/`authUid` instead of rejecting an unconstrained document-id query.
    private static func loadMembers(ids: [String], in db: Firestore) async throws -> [RemoteMember] {
        guard !ids.isEmpty else { return [] }
        var seen = Set<String>()
        let uniqueIds = ids.filter { seen.insert($0).inserted }
        var results: [RemoteMember] = []
        for id in uniqueIds {
            let doc = try await db.collection("members").document(id).getDocument()
            if let member = try? doc.data(as: RemoteMember.self) {
                results.append(member)
            }
        }
        return results
    }

    /// Match the Firestore conversation rules: users may read conversations
    /// they participate in, and board/admin members may also read bureau inboxes.
    private static func loadConversations(
        clubId: String,
        memberId: String,
        canReadBureauInbox: Bool,
        in db: Firestore
    ) async throws -> [RemoteConversation] {
        var conversationsById: [String: RemoteConversation] = [:]

        let participantSnap = try await db.collection("conversations")
            .whereField("clubId", isEqualTo: clubId)
            .whereField("participantIds", arrayContains: memberId)
            .getDocuments()
        for document in participantSnap.documents {
            if let conversation = try? document.data(as: RemoteConversation.self),
               let id = conversation.id {
                conversationsById[id] = conversation
            }
        }

        if canReadBureauInbox {
            let bureauSnap = try await db.collection("conversations")
                .whereField("clubId", isEqualTo: clubId)
                .whereField("kind", isEqualTo: ConversationKind.bureau.rawValue)
                .getDocuments()
            for document in bureauSnap.documents {
                if let conversation = try? document.data(as: RemoteConversation.self),
                   let id = conversation.id {
                    conversationsById[id] = conversation
                }
            }
        }

        return Array(conversationsById.values)
    }

    // MARK: - Writes

    /// Persists the member's active-club choice. `clubId` is a historical
    /// marker frozen at the member's first club and must never be touched
    /// here — only `defaultClubId` tracks which club is currently active.
    /// Security rules only accept clubs the member holds an active membership for.
    static func setDefaultClub(memberId: UUID, clubId: String) async throws {
        try await Backend.firestore.collection("members").document(memberId.uuidString)
            .setData(["defaultClubId": clubId], merge: true)
    }

    static func uploadProfilePhoto(memberId: UUID, data: Data) async throws -> String {
        let path = "profile_photos/\(memberId.uuidString)"
        let metadata = StorageMetadata()
        metadata.contentType = "image/jpeg"
        let ref = Backend.storage.reference().child(path)
        let _: StorageMetadata = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<StorageMetadata, Error>) in
            ref.putData(data, metadata: metadata) { metadata, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: metadata ?? StorageMetadata())
                }
            }
        }
        return path
    }

    static func deleteProfilePhoto(path: String) async throws {
        let _: Void = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<Void, Error>) in
            Backend.storage.reference().child(path).delete { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    static func updateMember(_ member: Member, memberId: String, clubId: String) async throws {
        let phone: Any = member.phone.isEmpty ? NSNull() : member.phone
        let birthDate: Any = member.birthDate.map { $0.timeIntervalSince1970 * 1000 } ?? NSNull()
        let photoPath: Any = member.photoPath ?? NSNull()
        let licenseNumber: Any = member.isLicensed ? member.licenceNumber : NSNull()
        _ = try await Backend.functions.httpsCallable("updateMemberProfile").call([
            "memberId": memberId,
            "clubId": clubId,
            "firstName": member.firstName,
            "lastName": member.lastName,
            "email": member.email,
            "phone": phone,
            "birthDate": birthDate,
            "photoPath": photoPath,
            "notifyAnnouncements": member.notifyAnnouncements,
            "notifyEvents": member.notifyEvents,
            "notifyPayments": member.notifyPayments,
            "notifyTournaments": member.notifyTournaments,
            "role": member.role.remoteValue,
            "isActive": member.isActive,
            "licenseNumber": licenseNumber,
        ])
    }

    static func upsertBankAccount(_ account: ClubBankAccount, clubId: String, by memberId: String?) async throws {
        let payload = BankAccountUpsert(
            clubId: clubId,
            holder: account.holder,
            iban: account.iban,
            bic: account.bic,
            bankName: account.bankName,
            acceptsTransfer: account.acceptsTransfer,
            acceptsCash: account.acceptsCash,
            transferNote: account.transferNote,
            cashNote: account.cashNote,
            updatedByMemberId: memberId
        )
        try await Backend.firestore
            .collection("club_bank_accounts")
            .document(clubId)
            .setData(encodedData(from: payload), merge: true)
    }

    static func createPaymentCall(_ call: PaymentCall, clubId: String, memberIds: [UUID: String]) async throws {
        let batch = Backend.firestore.batch()

        let callPayload = PaymentCallInsert(
            clubId: clubId,
            title: call.label,
            detail: call.reference,
            category: call.category.rawValue,
            amountCents: call.amountCents,
            currency: "eur",
            dueDate: call.dueDate,
            createdByMemberId: memberIds[call.createdById] ?? call.createdById.uuidString,
            createdAt: call.createdAt,
            notify: call.notify
        )
        let callRef = Backend.firestore.collection("payment_calls").document(call.id.uuidString)
        try batch.setData(from: callPayload, forDocument: callRef)

        for item in call.items {
            let itemPayload = PaymentItemInsert(
                paymentCallId: call.id.uuidString,
                clubId: clubId,
                memberId: memberIds[item.memberId] ?? item.memberId.uuidString,
                isPaid: false
            )
            let itemRef = Backend.firestore.collection("payment_call_items").document(item.id.uuidString)
            try batch.setData(from: itemPayload, forDocument: itemRef)
        }

        try await batch.commit()
    }

    static func declarePayment(itemId: String, method: PaymentMethodKind, reference: String?) async throws {
        _ = try await Backend.functions.httpsCallable("declarePayment").call([
            "itemId": itemId,
            "method": method.remoteValue,
            "reference": reference as Any,
        ])
    }

    static func validatePayment(itemId: String) async throws {
        _ = try await Backend.functions.httpsCallable("validatePayment").call(["itemId": itemId])
    }

    static func cancelDeclaration(itemId: String) async throws {
        _ = try await Backend.functions.httpsCallable("cancelPaymentDeclaration").call([
            "itemId": itemId,
        ])
    }

    /// The bureau records a payment it received outside the app.
    static func markPaid(itemId: String, method: PaymentMethodKind?) async throws {
        try await Backend.firestore.collection("payment_call_items").document(itemId).updateData([
            "isPaid": true,
            "paidAt": FieldValue.serverTimestamp(),
            "method": method?.remoteValue as Any,
            "declaredAt": NSNull(),
            "updatedAt": FieldValue.serverTimestamp(),
        ])
    }

    /// Marks the members who have just been chased about an unpaid line.
    static func remind(itemIds: [String]) async throws {
        guard !itemIds.isEmpty else { return }
        let batch = Backend.firestore.batch()
        for itemId in itemIds {
            let ref = Backend.firestore.collection("payment_call_items").document(itemId)
            batch.updateData([
                "remindedAt": FieldValue.serverTimestamp(),
                "updatedAt": FieldValue.serverTimestamp(),
            ], forDocument: ref)
        }
        try await batch.commit()
    }

    static func publishAnnouncement(_ announcement: Announcement, clubId: String, authorId: String) async throws {
        let payload = AnnouncementInsert(
            clubId: clubId,
            createdByMemberId: authorId,
            title: announcement.title,
            body: announcement.body,
            isPinned: announcement.isPinned,
            publishedAt: announcement.publishedAt,
            visibility: "members",
            createdAt: .now
        )
        try await Backend.firestore
            .collection("announcements")
            .document(announcement.id.uuidString)
            .setData(encodedData(from: payload))
    }

    static func deleteAnnouncement(id: String) async throws {
        try await Backend.firestore.collection("announcements").document(id).delete()
    }

    static func createEvent(_ event: ClubEvent, clubId: String) async throws {
        let payload = EventInsert(
            clubId: clubId,
            title: event.title,
            description: event.details,
            startsAt: event.date,
            location: event.location,
            category: event.kind.remoteValue
        )
        try await Backend.firestore.collection("events").document(event.id.uuidString)
            .setData(encodedData(from: payload))
    }

    static func setEventAttendance(
        _ response: Bool?,
        remoteEventId: String,
        clubId: String,
        memberId: String
    ) async throws {
        let registration = Backend.firestore.collection("event_registrations")
            .document("\(remoteEventId)_\(memberId)")
        guard let response else {
            try await registration.delete()
            return
        }
        let payload = EventRegistrationInsert(
            clubId: clubId,
            eventId: remoteEventId,
            memberId: memberId,
            status: response ? "going" : "declined"
        )
        try await registration.setData(encodedData(from: payload))
    }

    static func createTournament(_ tournament: Tournament, clubId: String, markerIds: [UUID: String]) async throws {
        let payload = TournamentInsert(
            clubId: clubId,
            name: tournament.name,
            date: tournament.date,
            location: tournament.location,
            markerIds: tournament.markerIds.map { markerIds[$0] ?? $0.uuidString },
            isFinished: tournament.isFinished
        )
        try await Backend.firestore.collection("tournaments").document(tournament.id.uuidString)
            .setData(encodedData(from: payload))
    }

    static func addTournamentEntry(
        _ entry: TournamentEntry,
        tournamentId: String,
        clubId: String,
        recordedByMemberId: String
    ) async throws {
        let payload = TournamentEntryInsert(
            clubId: clubId,
            tournamentId: tournamentId,
            tableau: entry.tableau,
            tour: entry.tour,
            playerA: entry.playerA,
            playerB: entry.playerB,
            scoreA: entry.scoreA,
            scoreB: entry.scoreB,
            note: entry.note,
            recordedByMemberId: recordedByMemberId,
            recordedAt: entry.recordedAt
        )
        try await Backend.firestore.collection("tournament_entries").document(entry.id.uuidString)
            .setData(encodedData(from: payload))
    }

    static func deleteTournamentEntry(id: String) async throws {
        try await Backend.firestore.collection("tournament_entries").document(id).delete()
    }

    static func createConversation(_ conversation: Conversation, clubId: String, participantIds: [UUID: String]) async throws {
        let payload = ConversationInsert(
            clubId: clubId,
            kind: conversation.kind.rawValue,
            participantIds: conversation.participantIds.map { participantIds[$0] ?? $0.uuidString }
        )
        try await Backend.firestore.collection("conversations").document(conversation.id.uuidString)
            .setData(encodedData(from: payload))
    }

    static func sendMessage(_ message: Message, conversationId: String, senderId: String, readBy: [String]) async throws {
        let payload = MessageInsert(
            senderId: senderId,
            text: message.text,
            sentAt: message.sentAt,
            readBy: readBy
        )
        try await Backend.firestore.collection("conversations").document(conversationId)
            .collection("messages").document(message.id.uuidString)
            .setData(encodedData(from: payload))
    }

    static func markConversationRead(conversationId: String, messageIds: [String], by memberId: String) async throws {
        let batch = Backend.firestore.batch()
        for messageId in messageIds {
            let ref = Backend.firestore.collection("conversations").document(conversationId)
                .collection("messages").document(messageId)
            batch.updateData(["readBy": FieldValue.arrayUnion([memberId])], forDocument: ref)
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
        try await Backend.firestore
            .collection("members")
            .document(userId.uuidString)
            .setData(encodedData(from: payload), merge: true)
    }

    /// Creates a brand-new club for the signed-in member, who becomes its
    /// admin. Must be called after `createSelfMember` — the member profile
    /// has to exist first, its `clubId` is completed by this call.
    /// - Returns: The real Firestore id of the newly created club.
    static func createClub(name: String) async throws -> String {
        do {
            let result = try await Backend.functions.httpsCallable("createClub").call(["name": name])
            guard let data = result.data as? [String: Any], let clubId = data["clubId"] as? String else {
                throw BackendError.message(tr("unexpected_server_response"))
            }
            return clubId
        } catch let error as BackendError {
            throw error
        } catch {
            let description = error.localizedDescription.lowercased()
            if description.contains("invalid-argument") {
                throw BackendError.message(tr("the_club_name_must_be_between_2_and_80_characters"))
            }
            if description.contains("already-exists") {
                throw BackendError.message(tr("a_club_with_a_very_similar_name_already_exists_choose_an"))
            }
            if description.contains("failed-precondition") {
                print("createClub failed precondition: \(error)")
                throw BackendError.message(tr("your_profile_is_not_ready_yet_please_try_again_in_a_mome"))
            }
            throw BackendError.message(tr("the_club_could_not_be_created_check_your_connection_and_"))
        }
    }

    // MARK: - Platform admin

    static func isPlatformAdmin(authUid: String) async -> Bool {
        (try? await Backend.firestore.collection("platform_admins")
            .document(authUid).getDocument().exists) == true
    }

    /// Asks the server whether the platform already has an administrator.
    /// Callable without being signed in, and returns nothing but the boolean.
    static func platformAdminExists() async throws -> Bool {
        let result = try await Backend.functions
            .httpsCallable("platformAdminExists").call([String: Any]())
        guard let data = result.data as? [String: Any], let exists = data["exists"] as? Bool else {
            throw BackendError.message(tr("unexpected_server_response"))
        }
        return exists
    }

    /// Claims the one and only bootstrap administrator slot for the signed-in
    /// auth user. Throws `.platformAdminAlreadyExists` when another device won
    /// the race.
    static func claimPlatformAdmin() async throws {
        do {
            _ = try await Backend.functions
                .httpsCallable("claimPlatformAdmin").call([String: Any]())
        } catch {
            let nsError = error as NSError
            if nsError.domain == FunctionsErrorDomain,
               FunctionsErrorCode(rawValue: nsError.code) == .alreadyExists {
                throw BackendError.platformAdminAlreadyExists
            }
            throw error
        }
    }

    static func loadPlatformClubs() async throws -> [Club] {
        (try await loadPlatformClubsWithRemoteIds()).clubs
    }

    static func loadPlatformClubsWithRemoteIds() async throws -> (clubs: [Club], remoteIdsByLocalId: [UUID: String]) {
        let db = Backend.firestore
        let clubs = try await db.collection("clubs").getDocuments().documents.compactMap {
            try? $0.data(as: RemoteClub.self)
        }
        var result: [Club] = []
        var remoteIdsByLocalId: [UUID: String] = [:]
        for remote in clubs {
            guard let id = remote.id else { continue }
            let clubUUID = remoteId(id)
            remoteIdsByLocalId[clubUUID] = id
            let memberships = try await db.collection("memberships")
                .whereField("clubId", isEqualTo: id)
                .whereField("status", isEqualTo: "active")
                .getDocuments()
            result.append(Club(
                id: clubUUID,
                name: remote.name,
                city: remote.address ?? remote.country ?? "",
                createdAt: remote.createdAt,
                renewalDate: remote.currentPeriodEnd
                    ?? remote.trialEndsAt
                    ?? remote.createdAt.addingTimeInterval(365 * 86_400),
                status: .fromRemote(remote.subscriptionStatus),
                seedMemberCount: memberships.documents.count,
                couponCode: remote.couponCode,
                stripeCustomerId: remote.stripeCustomerId,
                stripeSubscriptionId: remote.stripeSubscriptionId,
                bank: nil
            ))
        }
        return (result.sorted { $0.createdAt > $1.createdAt }, remoteIdsByLocalId)
    }

    static func loadCoupons() async throws -> [Coupon] {
        let documents = try await Backend.firestore.collection("coupons")
            .getDocuments().documents
        return documents.compactMap { document in
            guard let remote = try? document.data(as: RemoteCoupon.self),
                  let id = remote.id.flatMap(UUID.init(uuidString:)) else { return nil }
            return Coupon(
                id: id,
                code: remote.code,
                percent: remote.percent,
                expiresAt: remote.expiresAt,
                clubIds: remote.clubIds.map(remoteId),
                autoRenew: remote.autoRenew,
                createdAt: remote.createdAt ?? .now
            )
        }.sorted { $0.createdAt > $1.createdAt }
    }

    static func loadPlatformAnnouncements() async throws -> [PlatformAnnouncement] {
        let documents = try await Backend.firestore.collection("platform_announcements")
            .order(by: "publishedAt", descending: true)
            .getDocuments().documents
        return documents.compactMap { document in
            guard let remote = try? document.data(as: RemotePlatformAnnouncement.self),
                  let id = remote.id.flatMap(UUID.init(uuidString:)),
                  let audience = BroadcastAudience(rawValue: remote.audience) else { return nil }
            return PlatformAnnouncement(
                id: id,
                title: remote.title,
                body: remote.body,
                audience: audience,
                publishedAt: remote.publishedAt ?? .now
            )
        }
    }

    static func broadcast(title: String, body: String, audience: BroadcastAudience) async throws {
        _ = try await Backend.functions.httpsCallable("broadcastAnnouncement").call([
            "title": title,
            "body": body,
            "audience": audience.rawValue,
        ])
    }

    static func createCoupon(_ coupon: Coupon, clubIds: [String]) async throws {
        _ = try await Backend.functions.httpsCallable("createCoupon").call([
            "code": coupon.code,
            "percent": coupon.percent,
            "expiresAt": Timestamp(date: coupon.expiresAt),
            "clubIds": clubIds,
            "autoRenew": coupon.autoRenew,
        ])
    }

    static func deleteCoupon(id: UUID) async throws {
        _ = try await Backend.functions.httpsCallable("deleteCoupon").call([
            "couponId": id.uuidString,
        ])
    }

    // MARK: - Invitations

    /// The board invites someone by email; the membership is only created once
    /// that person signs up or signs in with the same address.
    struct Invitation: Identifiable, Sendable {
        var id: String { email }
        let email: String
        let inviteCode: String
        let inviteURL: URL?
    }

    static func inviteMember(clubId: String, email: String) async throws -> Invitation {
        let result = try await Backend.functions.httpsCallable("createInvitation").call([
            "clubId": clubId,
            "email": email,
        ])
        let data = result.data as? [String: Any]
        let urlString = data?["inviteUrl"] as? String
        return Invitation(
            email: email,
            inviteCode: data?["inviteCode"] as? String ?? "",
            inviteURL: urlString.flatMap(URL.init(string:))
        )
    }

    /// The board withdraws a pending invitation before it is accepted.
    static func revokeInvitation(clubId: String, email: String) async throws {
        _ = try await Backend.functions.httpsCallable("revokeInvitation").call([
            "clubId": clubId,
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

import FirebaseAuth
import Foundation

/// Everything that connects the in-memory `AppStore` to the live Firebase club.
///
/// The app keeps a single local `Database` as its source of truth so every
/// screen works unchanged. Reads replace that database wholesale; writes are
/// applied locally first (so the UI stays instant) and then pushed, with a
/// re-sync whenever the server refuses a change.
extension AppStore {
    // MARK: - Session

    /// Starts every app launch signed out. Firebase Auth persists credentials
    /// by default, so clear both the Firebase session and the local snapshot
    /// before showing the authentication screen.
    func restoreSession() async {
        if Backend.isConfigured {
            try? Backend.auth.signOut()
        }
        resetToSignedOutState()
        await checkPlatformAdminBootstrap()
        isRestoringSession = false
    }

    /// Drops any locally cached club data so no stale content survives a
    /// failed or absent session.
    private func resetToSignedOutState() {
        db = Database()
        currentUserId = nil
        notifications = []
        availableClubs = []
        activeClubRemoteId = nil
        remoteIdsByLocalId = [:]
        isPlatformAdmin = false
        needsPlatformAdminBootstrap = false
        isLive = false
        AnalyticsService.clearUserProperties()
        save()
    }

    /// Asks the server, only while nobody is signed in, whether the very first
    /// platform administrator still has to be created. The local confirmation
    /// is only a hint: staging can be reset from Firebase, and then the app
    /// must not stay stuck on the login screen with no admin account left.
    /// Any failure is treated as "an admin exists" so a network glitch can
    /// never strand a normal user on the bootstrap screen.
    func checkPlatformAdminBootstrap() async {
        guard Backend.isConfigured else {
            needsPlatformAdminBootstrap = false
            return
        }

        do {
            let exists = try await RemoteRepository.platformAdminExists()
            if exists {
                confirmPlatformAdminExists()
            } else {
                hasConfirmedPlatformAdminExists = false
                needsPlatformAdminBootstrap = true
            }
        } catch {
            print("Platform admin bootstrap check failed: \(error)")
            needsPlatformAdminBootstrap = false
        }
    }

    /// Records for good that the platform has an administrator.
    func confirmPlatformAdminExists() {
        hasConfirmedPlatformAdminExists = true
        needsPlatformAdminBootstrap = false
    }

    /// Signs a member in against Firebase.
    /// - Returns: `nil` on success, otherwise a message ready to display.
    func signInRemote(email: String, password: String) async -> String? {
        guard Backend.isConfigured else { return BackendError.notConfigured.errorDescription }
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        do {
            let result = try await Backend.auth.signIn(withEmail: normalized, password: password)
            isPlatformAdmin = await RemoteRepository.isPlatformAdmin(authUid: result.user.uid)
            guard let userId = try await RemoteRepository.memberId(forAuthUid: result.user.uid) else {
                if isPlatformAdmin {
                    isLive = true
                    await loadPlatformData()
                    AnalyticsService.logLogin(memberRole: "admin")
                    return nil
                }
                return friendlyMessage(for: BackendError.message(tr("profile_not_found_contact_support")))
            }
            let message = await loadRemote(userId: userId)
            await loadPlatformData()
            if message == nil {
                AnalyticsService.logLogin(memberRole: AnalyticsService.roleProperty(currentUser?.role ?? .membre))
            }
            return message
        } catch {
            print("Sign-in failed: \(error)")
            return friendlyMessage(for: error)
        }
    }

    /// Creates an account, mirrors it into `members`, then loads the club.
    func signUpRemote(
        firstName: String,
        lastName: String,
        email: String,
        password: String,
        phone: String
    ) async -> String? {
        guard Backend.isConfigured else { return BackendError.notConfigured.errorDescription }

        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let first = firstName.trimmingCharacters(in: .whitespacesAndNewlines)
        let last = lastName.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !first.isEmpty, !last.isEmpty else {
            return tr("enter_your_first_and_last_name")
        }
        guard password.count >= 6 else {
            return tr("the_password_must_be_at_least_6_characters_long")
        }

        do {
            let result = try await Backend.auth.createUser(withEmail: normalized, password: password)
            let userId = UUID()

            do {
                try await RemoteRepository.createSelfMember(
                    userId: userId,
                    authUid: result.user.uid,
                    firstName: first,
                    lastName: last,
                    email: normalized,
                    phone: phone.isEmpty ? nil : phone
                )
                let message = await loadRemote(userId: userId)
                if message != nil {
                    await rollbackCreatedAuthUser(result.user, context: "invited member sign-up")
                } else {
                    AnalyticsService.logSignUp(method: "invitation")
                }
                return message
            } catch {
                await rollbackCreatedAuthUser(result.user, context: "invited member sign-up")
                throw error
            }
        } catch {
            print("Sign-up failed: \(error)")
            return friendlyMessage(for: error)
        }
    }

    /// Creates an account, its member profile, then a brand-new club with the
    /// signer as its admin. Unlike `signUpRemote` (the invited-member path),
    /// this doesn't require any pending invitation.
    func signUpAndCreateClub(
        firstName: String,
        lastName: String,
        email: String,
        password: String,
        phone: String,
        clubName: String
    ) async -> String? {
        guard Backend.isConfigured else { return BackendError.notConfigured.errorDescription }

        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let first = firstName.trimmingCharacters(in: .whitespacesAndNewlines)
        let last = lastName.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = clubName.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !first.isEmpty, !last.isEmpty else {
            return tr("enter_your_first_and_last_name")
        }
        guard password.count >= 6 else {
            return tr("the_password_must_be_at_least_6_characters_long")
        }
        guard !name.isEmpty else {
            return tr("enter_your_club_s_name")
        }

        do {
            let result = try await Backend.auth.createUser(withEmail: normalized, password: password)
            let userId = UUID()

            do {
                try await RemoteRepository.createSelfMember(
                    userId: userId,
                    authUid: result.user.uid,
                    firstName: first,
                    lastName: last,
                    email: normalized,
                    phone: phone.isEmpty ? nil : phone
                )

                let clubId = try await RemoteRepository.createClub(name: name)

                let message = await loadRemote(userId: userId)
                if message == nil {
                    AnalyticsService.logSignUp(method: "club_creator")
                    AnalyticsService.logClubCreated(clubId: clubId, source: "sign_up")
                }
                return message
            } catch {
                await rollbackCreatedAuthUser(result.user, context: "club owner sign-up")
                throw error
            }
        } catch {
            print("Club creation failed: \(error)")
            return friendlyMessage(for: error)
        }
    }

    /// Creates a club for an authenticated member who has not joined one yet.
    /// The snapshot reload also switches the app into the new live club.
    func createClubFromOnboarding(name: String, userId: UUID) async -> String? {
        do {
            let clubId = try await RemoteRepository.createClub(name: name)
            let message = await loadRemote(userId: userId)
            if message == nil {
                AnalyticsService.logClubCreated(clubId: clubId, source: "onboarding")
            }
            return message
        } catch {
            print("Onboarding club creation failed: \(error)")
            return friendlyMessage(for: error)
        }
    }

    /// Sends a password reset email.
    func sendPasswordReset(email: String) async -> String {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard Backend.isConfigured, !normalized.isEmpty else {
            return tr("enter_your_email_address_to_receive_a_link")
        }

        do {
            try await Backend.auth.sendPasswordReset(withEmail: normalized)
            return tr("a_reset_link_has_just_been_sent_to_you")
        } catch {
            print("Password reset failed: \(error)")
            return friendlyMessage(for: error)
        }
    }

    // MARK: - Sync

    /// Pulls the club data and switches the app into live mode.
    func loadRemote(userId: UUID) async -> String? {
        isSyncing = true
        defer { isSyncing = false }

        do {
            let snapshot = try await loadSnapshotAcceptingInvitations(for: userId)
            applySnapshot(snapshot)
            platformAnnouncementsRemote = (try? await RemoteRepository.loadPlatformAnnouncements()) ?? []
            isLive = true
            needsOnboardingChoice = false
            syncError = nil
            save()
            await loadNotifications()
            scheduleDueReminders()
            await activatePushNotifications()
            return nil
        } catch {
            print("Club sync failed: \(error)")
            if case BackendError.noMembership = error {
                prepareOnboardingForMemberWithoutClub(userId: userId)
                return nil
            }
            return friendlyMessage(for: error)
        }
    }

    /// Loads the club snapshot, first accepting any pending invitation for
    /// this member's email — this both lands a first-time sign-in straight
    /// into their club, and lets an already-onboarded member pick up a later
    /// invitation to a second club. If that second club differs from the one
    /// currently active, `pendingClubSwitchOffer` is set so the UI can offer
    /// an immediate switch instead of silently reloading the old club.
    private func loadSnapshotAcceptingInvitations(for userId: UUID) async throws -> RemoteRepository.Snapshot {
        let joinedClubId = try await RemoteRepository.acceptPendingInvitation()

        let snapshot: RemoteRepository.Snapshot
        do {
            snapshot = try await RemoteRepository.loadSnapshot(for: userId, preferredClubId: activeClubRemoteId)
        } catch BackendError.noMembership {
            throw BackendError.noMembership
        }

        if let joinedClubId, joinedClubId != snapshot.activeClubRemoteId,
           let offer = snapshot.availableClubs.first(where: { $0.id == joinedClubId }) {
            pendingClubSwitchOffer = offer
        }
        if let joinedClubId {
            AnalyticsService.logClubJoined(clubId: joinedClubId)
        }

        return snapshot
    }

    private func rollbackCreatedAuthUser(_ user: User, context: String) async {
        do {
            try await user.delete()
        } catch {
            print("Auth rollback failed after \(context): \(error)")
        }
    }

    /// Re-reads everything from the server: pull-to-refresh, and recovery after
    /// a rejected write. Stays on the currently active club.
    func refresh() async {
        guard isLive, let userId = currentUserId, !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        do {
            let snapshot = try await loadSnapshotAcceptingInvitations(for: userId)
            applySnapshot(snapshot)
            platformAnnouncementsRemote = (try? await RemoteRepository.loadPlatformAnnouncements()) ?? []
            syncError = nil
            save()
            await loadNotifications()
            scheduleDueReminders()
            await activatePushNotifications()
        } catch {
            print("Refresh failed: \(error)")
            syncError = friendlyMessage(for: error)
        }
    }

    /// Switches the member's active club to one of their other memberships
    /// and reloads its data. No-op if the member only belongs to one club.
    func switchActiveClub(to clubId: String) async -> String? {
        guard isLive, let userId = currentUserId, clubId != activeClubRemoteId, !isSyncing else { return nil }
        isSyncing = true
        defer { isSyncing = false }

        do {
            try await RemoteRepository.setDefaultClub(memberId: userId, clubId: clubId)
            let snapshot = try await RemoteRepository.loadSnapshot(for: userId, preferredClubId: clubId)
            applySnapshot(snapshot)
            syncError = nil
            save()
            await loadNotifications()
            scheduleDueReminders()
            return nil
        } catch {
            print("Club switch failed: \(error)")
            return friendlyMessage(for: error)
        }
    }

    /// Accepts the offer surfaced by `pendingClubSwitchOffer` and switches to it.
    func confirmPendingClubSwitch() async {
        guard let offer = pendingClubSwitchOffer else { return }
        pendingClubSwitchOffer = nil
        _ = await switchActiveClub(to: offer.id)
    }

    /// Dismisses the offer without switching; the member stays on their
    /// current club and can switch later from the dashboard header.
    func dismissPendingClubSwitch() {
        pendingClubSwitchOffer = nil
    }

    private func applySnapshot(_ snapshot: RemoteRepository.Snapshot) {
        db = snapshot.database
        currentUserId = snapshot.currentMemberId
        availableClubs = snapshot.availableClubs
        activeClubRemoteId = snapshot.activeClubRemoteId
        remoteIdsByLocalId = snapshot.remoteIdsByLocalId
        let activeClubId = UUID(uuidString: snapshot.activeClubRemoteId)
        AnalyticsService.updateUserProperties(clubId: activeClubId, role: currentUser?.role)
    }

    // MARK: - Notifications

    var unreadNotificationCount: Int {
        notifications.filter(\.isUnread).count
    }

    func loadNotifications() async {
        guard isLive, let userId = currentUserId else { return }
        do {
            notifications = try await NotificationsRepository.load(memberId: userId)
        } catch {
            print("Notification inbox failed to load: \(error)")
        }
    }

    /// Marks the whole inbox as read, optimistically.
    func markAllNotificationsRead() {
        let unread = notifications.filter(\.isUnread).map(\.id)
        guard !unread.isEmpty, let userId = currentUserId else { return }
        for index in notifications.indices where notifications[index].isUnread {
            notifications[index].readAt = .now
        }
        push { try await NotificationsRepository.markAllRead(memberId: userId) }
    }

    func markNotificationRead(_ id: UUID) {
        guard let index = notifications.firstIndex(where: { $0.id == id }), notifications[index].isUnread else {
            return
        }
        notifications[index].readAt = .now
        push { try await NotificationsRepository.markRead(ids: [id]) }
    }

    func deleteNotification(_ id: UUID) {
        notifications.removeAll { $0.id == id }
        push { try await NotificationsRepository.delete(id: id) }
    }

    /// Stores the FCM token for this device so real push can be switched on
    /// without asking members to do anything.
    func registerPushToken(_ token: String) {
        registeredPushToken = token
        UserDefaults.standard.set(token, forKey: Self.pushTokenKey)
        guard isLive, let memberId = currentUserId else { return }
        push { try await NotificationsRepository.registerDeviceToken(token, memberId: memberId) }
    }

    func activatePushNotifications() async {
        if let token = await NotificationService.requestAuthorizationAndRegisterForRemoteNotifications() {
            registerPushToken(token)
        } else if let token = registeredPushToken {
            registerPushToken(token)
        }
    }

    /// Re-arms the local reminders for everything this member still owes.
    func scheduleDueReminders() {
        guard let userId = currentUserId else { return }
        let outstanding = payments(for: userId).filter { !$0.item.isPaid && $0.item.declaredAt == nil }
        NotificationService.scheduleDueReminders(
            outstanding.map { entry in
                NotificationService.DueReminder(
                    id: entry.item.id,
                    label: entry.call.label,
                    amountCents: entry.call.amountCents,
                    dueDate: entry.call.dueDate
                )
            }
        )
    }

    /// Pushes a mutation after the local state has already been updated. A
    /// failure is surfaced and the club re-synced, so the screen never keeps a
    /// change the server rejected.
    func push(
        _ operation: @escaping @Sendable () async throws -> Void,
        onSuccess: (@MainActor @Sendable () -> Void)? = nil
    ) {
        guard isLive else { return }
        Task { @MainActor in
            do {
                try await operation()
                onSuccess?()
            } catch {
                print("Backend write failed: \(error)")
                syncError = friendlyMessage(for: error)
                await refresh()
            }
        }
    }
}

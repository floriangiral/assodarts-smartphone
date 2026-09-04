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

    /// Restores a stored Firebase session at launch. Falls back to demo mode
    /// when nobody is signed in or the device is offline.
    func restoreSession() async {
        guard Backend.isConfigured else {
            isRestoringSession = false
            return
        }

        guard let user = Backend.auth.currentUser else {
            mode = .demo
            isRestoringSession = false
            return
        }

        do {
            guard let userId = try await RemoteRepository.memberId(forAuthUid: user.uid) else {
                mode = .demo
                isRestoringSession = false
                return
            }
            _ = await loadRemote(userId: userId)
        } catch {
            print("Session restore failed: \(error)")
            mode = .demo
        }
        isRestoringSession = false
    }

    /// Signs a member in against Firebase.
    /// - Returns: `nil` on success, otherwise a message ready to display.
    func signInRemote(email: String, password: String) async -> String? {
        guard Backend.isConfigured else { return BackendError.notConfigured.errorDescription }
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        do {
            let result = try await Backend.auth.signIn(withEmail: normalized, password: password)
            guard let userId = try await RemoteRepository.memberId(forAuthUid: result.user.uid) else {
                return friendlyMessage(for: BackendError.message(tr(
                    "Profil introuvable. Contactez le support.",
                    "Profile not found. Contact support."
                )))
            }
            return await loadRemote(userId: userId)
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
            return tr("Indiquez votre prénom et votre nom.", "Enter your first and last name.")
        }
        guard password.count >= 6 else {
            return tr(
                "Le mot de passe doit contenir au moins 6 caractères.",
                "The password must be at least 6 characters long."
            )
        }

        do {
            let result = try await Backend.auth.createUser(withEmail: normalized, password: password)
            let userId = UUID()

            try await RemoteRepository.createSelfMember(
                userId: userId,
                authUid: result.user.uid,
                firstName: first,
                lastName: last,
                email: normalized,
                phone: phone.isEmpty ? nil : phone
            )
            return await loadRemote(userId: userId)
        } catch {
            print("Sign-up failed: \(error)")
            return friendlyMessage(for: error)
        }
    }

    /// Sends a password reset email.
    func sendPasswordReset(email: String) async -> String {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard Backend.isConfigured, !normalized.isEmpty else {
            return tr(
                "Renseignez votre adresse email pour recevoir un lien.",
                "Enter your email address to receive a link."
            )
        }

        do {
            try await Backend.auth.sendPasswordReset(withEmail: normalized)
            return tr(
                "Un lien de réinitialisation vient de vous être envoyé.",
                "A reset link has just been sent to you."
            )
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
            mode = .live
            syncError = nil
            save()
            await loadNotifications()
            scheduleDueReminders()
            return nil
        } catch {
            print("Club sync failed: \(error)")
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
        let joinedClubId = try? await RemoteRepository.acceptPendingInvitation()

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

        return snapshot
    }

    /// Re-reads everything from the server: pull-to-refresh, and recovery after
    /// a rejected write. Stays on the currently active club.
    func refresh() async {
        guard mode == .live, let userId = currentUserId, !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        do {
            let snapshot = try await loadSnapshotAcceptingInvitations(for: userId)
            applySnapshot(snapshot)
            syncError = nil
            save()
            await loadNotifications()
            scheduleDueReminders()
        } catch {
            print("Refresh failed: \(error)")
            syncError = friendlyMessage(for: error)
        }
    }

    /// Switches the member's active club to one of their other memberships
    /// and reloads its data. No-op if the member only belongs to one club.
    func switchActiveClub(to clubId: String) async -> String? {
        guard mode == .live, let userId = currentUserId, clubId != activeClubRemoteId, !isSyncing else { return nil }
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
    }

    // MARK: - Notifications

    var unreadNotificationCount: Int {
        notifications.filter(\.isUnread).count
    }

    func loadNotifications() async {
        guard mode == .live, let userId = currentUserId else { return }
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
        guard mode == .live, let memberId = currentUserId else { return }
        push { try await NotificationsRepository.registerDeviceToken(token, memberId: memberId) }
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
    func push(_ operation: @escaping @Sendable () async throws -> Void) {
        guard mode == .live else { return }
        Task { @MainActor in
            do {
                try await operation()
            } catch {
                print("Backend write failed: \(error)")
                syncError = friendlyMessage(for: error)
                await refresh()
            }
        }
    }
}

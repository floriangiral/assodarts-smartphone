//
//  AssodartsTests.swift
//  AssodartsTests
//

import Foundation
import Testing
@testable import Assodarts

struct AssodartsTests {

    @Test func paymentItemStateFollowsPaymentLifecycle() {
        let dueDate = Date.now.addingTimeInterval(86_400)
        var item = PaymentItem(memberId: UUID())

        #expect(item.state(dueDate: dueDate) == .pending)

        item.declaredAt = .now
        #expect(item.state(dueDate: dueDate) == .awaitingValidation)

        item.isPaid = true
        #expect(item.state(dueDate: dueDate) == .paid)
    }

    @Test func overduePaymentIsLateWithoutDeclaration() {
        let item = PaymentItem(memberId: UUID())
        let dueDate = Date.now.addingTimeInterval(-86_400)

        #expect(item.state(dueDate: dueDate) == .late)
    }

    @Test func clubManagementPermissionsMatchRoles() {
        #expect(!Role.membre.canManageClub)
        #expect(Role.bureau.canManageClub)
        #expect(Role.admin.canManageClub)
        #expect(!Role.bureau.canManageRoles)
        #expect(Role.admin.canManageRoles)
    }

    @Test func pricingTierSelectsTheFirstMatchingCapacity() {
        #expect(PricingTier.tier(forMemberCount: 20).id == "essentiel")
        #expect(PricingTier.tier(forMemberCount: 21).id == "club")
        #expect(PricingTier.tier(forMemberCount: 201).id == "devis")
    }

    @Test func ibanValidationRejectsInvalidChecksum() {
        var account = ClubBankAccount()
        account.iban = "FR1420041010050500013M02606"
        #expect(account.isIbanValid)

        account.iban = "FR1420041010050500013M02607"
        #expect(!account.isIbanValid)
    }

    @MainActor
    @Test func onboardingPreparationKeepsMemberIdAndClearsClubState() {
        let memberId = UUID()
        let staleClubId = UUID()
        let store = AppStore()
        store.db = Database(
            clubs: [
                Club(
                    id: staleClubId,
                    name: "Old Club",
                    city: "Paris",
                    createdAt: .now,
                    renewalDate: .now,
                    status: .trial,
                    seedMemberCount: 1
                )
            ],
            members: [
                Member(
                    id: memberId,
                    clubId: staleClubId,
                    firstName: "Ada",
                    lastName: "Lovelace",
                    email: "ada@example.com"
                )
            ]
        )
        store.currentUserId = nil
        store.availableClubs = [.init(id: "old-club", name: "Old Club")]
        store.activeClubRemoteId = "old-club"
        store.pendingClubSwitchOffer = .init(id: "other-club", name: "Other Club")
        store.needsOnboardingChoice = false
        store.isLive = false
        store.syncError = "stale error"

        store.prepareOnboardingForMemberWithoutClub(userId: memberId)

        #expect(store.currentUserId == memberId)
        #expect(store.needsOnboardingChoice)
        #expect(store.isLive)
        #expect(store.syncError == nil)
        #expect(store.db.clubs.isEmpty)
        #expect(store.db.members.isEmpty)
        #expect(store.availableClubs.isEmpty)
        #expect(store.activeClubRemoteId == nil)
        #expect(store.pendingClubSwitchOffer == nil)
    }

}

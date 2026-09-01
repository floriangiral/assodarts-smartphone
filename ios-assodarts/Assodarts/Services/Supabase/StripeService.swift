import Foundation
import Supabase

// MARK: - Edge function payloads

nonisolated struct ClubIdRequest: Encodable, Sendable {
    let clubId: String
}

nonisolated struct ItemIdRequest: Encodable, Sendable {
    let itemId: String
}

nonisolated struct ConnectOnboardResponse: Codable, Sendable {
    let url: String
    let accountId: String?
    let status: String
}

nonisolated struct ConnectStatusResponse: Codable, Sendable {
    let status: String
    let chargesEnabled: Bool
    let detailsSubmitted: Bool
}

nonisolated struct CheckoutResponse: Codable, Sendable {
    let url: String
    let sessionId: String
}

/// Calls the Stripe edge functions.
///
/// Nothing sensitive lives in the app: the secret key, the amounts and the
/// permission checks all stay server-side. The app only ever receives a
/// short-lived hosted URL to open.
enum StripeService {
    struct Onboarding: Sendable {
        let url: URL
        let accountId: String?
        let status: StripeAccountStatus
    }

    /// Creates (or resumes) the club's Stripe Connect account and returns the
    /// hosted onboarding URL.
    static func startOnboarding(clubId: UUID) async throws -> Onboarding {
        let response: ConnectOnboardResponse = try await Backend.client.functions.invoke(
            "stripe-connect-onboard",
            options: .init(body: ClubIdRequest(clubId: clubId.uuidString))
        )
        guard let url = URL(string: response.url) else {
            throw BackendError.message(tr(
                "Lien Stripe invalide. Réessayez.",
                "Invalid Stripe link. Please try again."
            ))
        }
        return Onboarding(
            url: url,
            accountId: response.accountId,
            status: .fromRemote(response.status)
        )
    }

    /// Re-reads the connected account after onboarding.
    static func refreshStatus(clubId: UUID) async throws -> StripeAccountStatus {
        let response: ConnectStatusResponse = try await Backend.client.functions.invoke(
            "stripe-connect-status",
            options: .init(body: ClubIdRequest(clubId: clubId.uuidString))
        )
        return .fromRemote(response.status)
    }

    /// Opens a Stripe Checkout session for one payment line. Apple Pay and card
    /// are both offered on the hosted page.
    static func createCheckout(itemId: UUID) async throws -> URL {
        let response: CheckoutResponse = try await Backend.client.functions.invoke(
            "stripe-create-checkout",
            options: .init(body: ItemIdRequest(itemId: itemId.uuidString))
        )
        guard let url = URL(string: response.url) else {
            throw BackendError.message(tr(
                "Paiement indisponible pour le moment.",
                "Payment is unavailable right now."
            ))
        }
        return url
    }
}

import FirebaseFunctions
import Foundation

nonisolated struct ConnectOnboardResponse: Decodable, Sendable {
    let url: String
    let accountId: String?
    let status: String
}

nonisolated struct ConnectStatusResponse: Decodable, Sendable {
    let status: String
    let chargesEnabled: Bool
    let detailsSubmitted: Bool
}

nonisolated struct CheckoutResponse: Decodable, Sendable {
    let url: String
    let sessionId: String
}

nonisolated struct BillingPortalResponse: Decodable, Sendable {
    let url: String
}

/// Calls the Stripe Cloud Functions.
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
        let result = try await Backend.functions.httpsCallable("stripeConnectOnboard")
            .call(["clubId": clubId.uuidString])
        let response = try decode(result.data, as: ConnectOnboardResponse.self)
        guard let url = URL(string: response.url) else {
            throw BackendError.message(tr("invalid_stripe_link_please_try_again"))
        }
        return Onboarding(url: url, accountId: response.accountId, status: .fromRemote(response.status))
    }

    /// Re-reads the connected account after onboarding.
    static func refreshStatus(clubId: UUID) async throws -> StripeAccountStatus {
        let result = try await Backend.functions.httpsCallable("stripeConnectStatus")
            .call(["clubId": clubId.uuidString])
        let response = try decode(result.data, as: ConnectStatusResponse.self)
        return .fromRemote(response.status)
    }

    /// Opens a Stripe Checkout session for one payment line. Apple Pay and card
    /// are both offered on the hosted page.
    static func createCheckout(itemId: UUID) async throws -> URL {
        let result = try await Backend.functions.httpsCallable("stripeCreateCheckout")
            .call(["itemId": itemId.uuidString])
        let response = try decode(result.data, as: CheckoutResponse.self)
        guard let url = URL(string: response.url) else {
            throw BackendError.message(tr("payment_is_unavailable_right_now"))
        }
        return url
    }

    /// Opens Stripe Checkout for the club's own yearly Assodarts subscription.
    /// The price is decided server-side from the club's member count.
    static func startClubSubscriptionCheckout(clubId: UUID) async throws -> URL {
        let result = try await Backend.functions
            .httpsCallable("stripeCreateClubSubscriptionCheckout")
            .call(["clubId": clubId.uuidString])
        let response = try decode(result.data, as: CheckoutResponse.self)
        guard let url = URL(string: response.url) else {
            throw BackendError.message(tr("payment_is_unavailable_right_now"))
        }
        return url
    }

    /// Opens Stripe's hosted billing portal to change card, read invoices or cancel.
    static func openBillingPortal(clubId: UUID) async throws -> URL {
        let result = try await Backend.functions
            .httpsCallable("stripeCreateClubBillingPortal")
            .call(["clubId": clubId.uuidString])
        let response = try decode(result.data, as: BillingPortalResponse.self)
        guard let url = URL(string: response.url) else {
            throw BackendError.message(tr("payment_is_unavailable_right_now"))
        }
        return url
    }

    /// Callable Cloud Function results come back as loosely-typed `Any`; this
    /// re-serializes them through JSON to reuse `Decodable`.
    private static func decode<T: Decodable>(_ data: Any, as type: T.Type) throws -> T {
        let json = try JSONSerialization.data(withJSONObject: data)
        return try JSONDecoder().decode(T.self, from: json)
    }
}

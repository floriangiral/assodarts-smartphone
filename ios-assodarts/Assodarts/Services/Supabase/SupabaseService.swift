import Foundation
import Supabase

/// The project's single Supabase client.
///
/// The backend runs in **native Supabase Auth** mode (email + password), so the
/// SDK owns the session and refreshes tokens on its own — there is deliberately
/// no custom access-token closure here.
enum Backend {
    private static let placeholderURL = URL(string: "https://unconfigured.supabase.co")!

    static let client = SupabaseClient(
        supabaseURL: URL(string: Config.EXPO_PUBLIC_SUPABASE_URL) ?? placeholderURL,
        supabaseKey: Config.EXPO_PUBLIC_SUPABASE_ANON_KEY
    )

    /// False when the build carries no Supabase credentials. The app then stays
    /// in local demo mode instead of failing every single request.
    static var isConfigured: Bool {
        !Config.EXPO_PUBLIC_SUPABASE_URL.isEmpty && !Config.EXPO_PUBLIC_SUPABASE_ANON_KEY.isEmpty
    }
}

/// Where the data currently displayed comes from.
enum BackendMode: String, Sendable {
    /// Local seeded data — lets anyone explore the app without an account.
    case demo
    /// Live Supabase data for the signed-in member.
    case live

    var label: String {
        switch self {
        case .demo: tr("Mode démonstration", "Demo mode")
        case .live: tr("Données du club", "Club data")
        }
    }
}

/// Errors surfaced to the user, already translated.
nonisolated enum BackendError: LocalizedError, Sendable {
    case notConfigured
    case noMembership
    case message(String)

    nonisolated var errorDescription: String? {
        switch self {
        case .notConfigured:
            tr(
                "La connexion au serveur n'est pas configurée sur cette version.",
                "The server connection is not configured in this build."
            )
        case .noMembership:
            tr(
                "Votre compte n'est rattaché à aucun club. Demandez une invitation au bureau.",
                "Your account is not linked to any club yet. Ask the committee for an invitation."
            )
        case let .message(text):
            text
        }
    }
}

/// Turns a raw Supabase/network error into something a club member can read.
nonisolated func friendlyMessage(for error: Error) -> String {
    if let backendError = error as? BackendError, let description = backendError.errorDescription {
        return description
    }

    let raw = error.localizedDescription.lowercased()

    if raw.contains("invalid login credentials") || raw.contains("invalid_credentials") {
        return tr(
            "Adresse email ou mot de passe incorrect.",
            "Incorrect email address or password."
        )
    }
    if raw.contains("email not confirmed") {
        return tr(
            "Confirmez votre adresse email avant de vous connecter.",
            "Confirm your email address before signing in."
        )
    }
    if raw.contains("user already registered") || raw.contains("already been registered") {
        return tr(
            "Un compte existe déjà avec cette adresse.",
            "An account already exists with this email address."
        )
    }
    if raw.contains("password") && raw.contains("6") {
        return tr(
            "Le mot de passe doit contenir au moins 6 caractères.",
            "The password must be at least 6 characters long."
        )
    }
    if raw.contains("offline") || raw.contains("internet") || raw.contains("network") {
        return tr(
            "Connexion impossible. Vérifiez votre réseau puis réessayez.",
            "Cannot reach the server. Check your connection and try again."
        )
    }

    return tr(
        "Une erreur est survenue. Réessayez dans un instant.",
        "Something went wrong. Please try again in a moment."
    )
}

import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
import FirebaseFunctions
import Foundation

/// The project's Firebase handles, configured once at app launch from the
/// environment-specific plist when available, with a compile-time fallback.
enum Backend {
    /// Configures Firebase. Safe to call once; `AssodartsApp` does this at
    /// launch before any screen touches `Backend`.
    static func configure() {
        guard isConfigured, FirebaseApp.app() == nil else { return }
        if let plistPath = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let options = FirebaseOptions(contentsOfFile: plistPath) {
            FirebaseApp.configure(options: options)
            return
        }
        let options = FirebaseOptions(
            googleAppID: Config.FIREBASE_APP_ID,
            gcmSenderID: Config.FIREBASE_GCM_SENDER_ID
        )
        options.apiKey = Config.FIREBASE_API_KEY
        options.projectID = Config.FIREBASE_PROJECT_ID
        options.storageBucket = Config.FIREBASE_STORAGE_BUCKET
        FirebaseApp.configure(options: options)
    }

    static var auth: Auth { Auth.auth() }
    static var firestore: Firestore { Firestore.firestore() }
    static var functions: Functions { Functions.functions() }

    /// False when the build carries no Firebase credentials. The app then
    /// stays in local demo mode instead of failing every single request.
    static var isConfigured: Bool {
        !Config.FIREBASE_API_KEY.isEmpty
            && !Config.FIREBASE_APP_ID.isEmpty
            && !Config.FIREBASE_PROJECT_ID.isEmpty
            && !Config.FIREBASE_GCM_SENDER_ID.isEmpty
    }
}

/// Where the data currently displayed comes from.
enum BackendMode: String, Sendable {
    /// Local seeded data — lets anyone explore the app without an account.
    case demo
    /// Live Firebase data for the signed-in member.
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

/// Turns a raw Firebase Auth/Firestore error into something a club member can read.
nonisolated func friendlyMessage(for error: Error) -> String {
    if let backendError = error as? BackendError, let description = backendError.errorDescription {
        return description
    }

    if let authErrorCode = AuthErrorCode(rawValue: (error as NSError).code) {
        switch authErrorCode {
        case .wrongPassword, .invalidCredential, .userNotFound:
            return tr("Adresse email ou mot de passe incorrect.", "Incorrect email address or password.")
        case .emailAlreadyInUse:
            return tr(
                "Un compte existe déjà avec cette adresse.",
                "An account already exists with this email address."
            )
        case .weakPassword:
            return tr(
                "Le mot de passe doit contenir au moins 6 caractères.",
                "The password must be at least 6 characters long."
            )
        case .networkError:
            return tr(
                "Connexion impossible. Vérifiez votre réseau puis réessayez.",
                "Cannot reach the server. Check your connection and try again."
            )
        default:
            break
        }
    }

    let raw = error.localizedDescription.lowercased()
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

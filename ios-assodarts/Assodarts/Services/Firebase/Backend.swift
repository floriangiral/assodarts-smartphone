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
    /// stays on the login screen with an empty local database.
    static var isConfigured: Bool {
        !Config.FIREBASE_API_KEY.isEmpty
            && !Config.FIREBASE_APP_ID.isEmpty
            && !Config.FIREBASE_PROJECT_ID.isEmpty
            && !Config.FIREBASE_GCM_SENDER_ID.isEmpty
    }
}

/// Errors surfaced to the user, already translated.
nonisolated enum BackendError: LocalizedError, Sendable {
    case notConfigured
    case noMembership
    case platformAdminAlreadyExists
    case message(String)

    nonisolated var errorDescription: String? {
        switch self {
        case .notConfigured:
            tr("the_server_connection_is_not_configured_in_this_build")
        case .noMembership:
            tr("your_account_is_not_linked_to_any_club_yet_ask_the_commi")
        case .platformAdminAlreadyExists:
            tr("an_administrator_has_already_been_created_sign_in_instead")
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
            return tr("incorrect_email_address_or_password")
        case .emailAlreadyInUse:
            return tr("an_account_already_exists_with_this_email_address")
        case .weakPassword:
            return tr("the_password_must_be_at_least_6_characters_long")
        case .networkError:
            return tr("cannot_reach_the_server_check_your_connection_and_try_ag")
        default:
            break
        }
    }

    let raw = error.localizedDescription.lowercased()
    if raw.contains("offline") || raw.contains("internet") || raw.contains("network") {
        return tr("cannot_reach_the_server_check_your_connection_and_try_ag")
    }

    return tr("something_went_wrong_please_try_again_in_a_moment")
}

import Foundation
import SwiftUI

/// A language the interface is available in.
enum Lang: String, Codable, Sendable, Hashable {
    case fr
    case en
}

/// What the user picked in the settings: follow the device, or force a language.
enum AppLanguage: String, CaseIterable, Identifiable, Codable, Sendable {
    case system
    case french
    case english

    var id: String { rawValue }

    var lang: Lang? {
        switch self {
        case .system: nil
        case .french: .fr
        case .english: .en
        }
    }

    nonisolated var label: String {
        switch self {
        case .system: tr("Automatique (appareil)", "Automatic (device)")
        case .french: "Français"
        case .english: "English"
        }
    }
}

/// Reads the device preference and maps it to a supported language.
/// Anything that is not French falls back to English.
nonisolated func detectDeviceLanguage() -> Lang {
    let candidates = Locale.preferredLanguages.isEmpty
        ? [Locale.current.identifier]
        : Locale.preferredLanguages
    for candidate in candidates {
        let code = candidate.lowercased()
        if code.hasPrefix("fr") { return .fr }
        if code.hasPrefix("en") { return .en }
    }
    return .en
}

/// The language currently used to resolve `tr(_:_:)`. Mirrored from
/// `Localization.shared` so it can be read from any context, including
/// value types and formatters.
nonisolated(unsafe) private var activeLanguage: Lang = detectDeviceLanguage()

/// Returns the French or English variant of a piece of copy.
///
/// Strings live side by side at their point of use, which keeps every screen
/// readable and makes a missing translation impossible.
nonisolated func tr(_ french: String, _ english: String) -> String {
    activeLanguage == .fr ? french : english
}

/// The active language, readable from anywhere.
nonisolated var currentLang: Lang { activeLanguage }

/// Language preference store. Persisted and applied at launch, before any view
/// is built, so the very first screen is already in the right language.
@Observable
final class Localization {
    static let shared = Localization()

    private static let storageKey = "assodarts.language.v1"

    var preference: AppLanguage {
        didSet {
            UserDefaults.standard.set(preference.rawValue, forKey: Self.storageKey)
            apply()
        }
    }

    private init() {
        let raw = UserDefaults.standard.string(forKey: Self.storageKey) ?? ""
        preference = AppLanguage(rawValue: raw) ?? .system
        apply()
    }

    private func apply() {
        activeLanguage = preference.lang ?? detectDeviceLanguage()
    }

    /// Resolved language actually shown on screen.
    var lang: Lang { preference.lang ?? detectDeviceLanguage() }

    /// Locale used for dates, numbers, currency and the system keyboard.
    var locale: Locale {
        lang == .fr ? Locale(identifier: "fr_FR") : Locale(identifier: "en_GB")
    }

    /// Language tag pushed to the text input system so dictation and
    /// autocorrection match the interface.
    var keyboardLanguage: String {
        lang == .fr ? "fr-FR" : "en-GB"
    }
}

/// Compact language switcher used on the login screen and in the profile.
struct LanguageMenu: View {
    @Environment(Localization.self) private var localization
    var compact: Bool = false

    var body: some View {
        Menu {
            Picker(tr("Langue", "Language"), selection: Binding(
                get: { localization.preference },
                set: { localization.preference = $0 }
            )) {
                ForEach(AppLanguage.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "globe")
                    .font(.footnote.weight(.semibold))
                if !compact {
                    Text(localization.lang == .fr ? "FR" : "EN")
                        .font(.footnote.weight(.semibold))
                }
            }
            .foregroundStyle(Theme.navy)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Theme.navyTint, in: .capsule)
        }
    }
}

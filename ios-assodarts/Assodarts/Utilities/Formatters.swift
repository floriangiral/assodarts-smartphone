import Foundation

/// Locale-aware formatting helpers shared across the app. Everything follows the
/// interface language, so an English user sees English months and `€45.00`
/// while a French user sees `45,00 €`.
enum Fmt {
    nonisolated static var locale: Locale {
        currentLang == .fr ? Locale(identifier: "fr_FR") : Locale(identifier: "en_GB")
    }

    /// Formats cents into a localized amount, e.g. `4500` → `45,00 €` / `€45.00`.
    nonisolated static func money(_ cents: Int) -> String {
        (Decimal(cents) / 100).formatted(.currency(code: "EUR").locale(locale))
    }

    /// Whole-euro rendering used for subscription tiers, e.g. `89 €` / `€89`.
    nonisolated static func euros(_ euros: Int) -> String {
        let number = euros.formatted(.number.locale(locale))
        return currentLang == .fr ? "\(number) €" : "€\(number)"
    }

    nonisolated static func shortDate(_ date: Date) -> String {
        date.formatted(.dateTime.locale(locale).day().month(.abbreviated))
    }

    nonisolated static func mediumDate(_ date: Date) -> String {
        date.formatted(.dateTime.locale(locale).day().month(.wide).year())
    }

    nonisolated static func dayAndTime(_ date: Date) -> String {
        date.formatted(.dateTime.locale(locale).weekday(.wide).day().month(.wide).hour().minute())
    }

    nonisolated static func time(_ date: Date) -> String {
        date.formatted(.dateTime.locale(locale).hour().minute())
    }

    /// Relative label used in conversation lists: `09:24`, `hier`, `Mon`, `12 Sep`.
    nonisolated static func conversationStamp(_ date: Date) -> String {
        let calendar = Calendar(identifier: .gregorian)
        if calendar.isDateInToday(date) { return time(date) }
        if calendar.isDateInYesterday(date) { return tr("yesterday") }
        guard let days = calendar.dateComponents([.day], from: date, to: .now).day else {
            return shortDate(date)
        }
        if days < 7 {
            return date.formatted(.dateTime.locale(locale).weekday(.abbreviated))
        }
        return shortDate(date)
    }

    nonisolated static func daySeparator(_ date: Date) -> String {
        let calendar = Calendar(identifier: .gregorian)
        if calendar.isDateInToday(date) { return tr("today") }
        if calendar.isDateInYesterday(date) { return tr("yesterday_formatters") }
        return mediumDate(date)
    }

    /// Pluralizes a countable label in both languages, e.g. `3 membres` / `3 members`.
        enum CountKey {
            case clubs
            case targetedClubs
            case openCalls
            case attendees
            case committeeMembers
            case pendingPayments
            case results
            case paymentsToConfirm
            case memberDeclarations
            case clubMembers
            case members
            case duePayments
        }

        /// Resolves a count through String Catalog plural variations.
        nonisolated static func count(_ value: Int, key: CountKey) -> String {
            switch key {
            case .clubs: return tr("count_clubs \(value)")
            case .targetedClubs: return tr("count_targeted_clubs \(value)")
            case .openCalls: return tr("count_open_calls \(value)")
            case .attendees: return tr("count_attendees \(value)")
            case .committeeMembers: return tr("count_committee_members \(value)")
            case .pendingPayments: return tr("count_pending_payments \(value)")
            case .results: return tr("count_results \(value)")
            case .paymentsToConfirm: return tr("count_payments_to_confirm \(value)")
            case .memberDeclarations: return tr("count_member_declarations \(value)")
            case .clubMembers: return tr("count_club_members \(value)")
            case .members: return tr("count_members \(value)")
            case .duePayments: return tr("count_due_payments \(value)")
            }
    }

    nonisolated static func number(_ value: Int) -> String {
        value.formatted(.number.locale(locale))
    }
}

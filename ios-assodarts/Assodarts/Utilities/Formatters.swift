import Foundation

/// French formatting helpers shared across the app.
enum Fmt {
    static let locale = Locale(identifier: "fr_FR")

    private static let currency: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "EUR"
        f.locale = locale
        return f
    }()

    /// Formats cents into a French amount, e.g. `4500` → `45,00 €`.
    static func money(_ cents: Int) -> String {
        currency.string(from: NSNumber(value: Double(cents) / 100)) ?? "\(cents / 100) €"
    }

    /// Whole-euro rendering used for subscription tiers, e.g. `89 €`.
    static func euros(_ euros: Int) -> String {
        "\(euros.formatted(.number.locale(locale))) €"
    }

    static func shortDate(_ date: Date) -> String {
        date.formatted(.dateTime.locale(locale).day().month(.abbreviated))
    }

    static func mediumDate(_ date: Date) -> String {
        date.formatted(.dateTime.locale(locale).day().month(.wide).year())
    }

    static func dayAndTime(_ date: Date) -> String {
        date.formatted(.dateTime.locale(locale).weekday(.wide).day().month(.wide).hour().minute())
    }

    static func time(_ date: Date) -> String {
        date.formatted(.dateTime.locale(locale).hour().minute())
    }

    /// Relative label used in conversation lists: `09:24`, `hier`, `lun.`, `12 sept.`
    static func conversationStamp(_ date: Date) -> String {
        let calendar = Calendar(identifier: .gregorian)
        if calendar.isDateInToday(date) { return time(date) }
        if calendar.isDateInYesterday(date) { return "hier" }
        guard let days = calendar.dateComponents([.day], from: date, to: .now).day else {
            return shortDate(date)
        }
        if days < 7 {
            return date.formatted(.dateTime.locale(locale).weekday(.abbreviated))
        }
        return shortDate(date)
    }

    static func daySeparator(_ date: Date) -> String {
        let calendar = Calendar(identifier: .gregorian)
        if calendar.isDateInToday(date) { return "Aujourd'hui" }
        if calendar.isDateInYesterday(date) { return "Hier" }
        return mediumDate(date)
    }
}

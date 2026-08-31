import Foundation
import SwiftUI

/// State of the club's online collection account. Card, Apple Pay and Google Pay
/// only become available once the account is verified.
enum StripeAccountStatus: String, Codable, Sendable {
    case notConnected
    case pending
    case verified

    var label: String {
        switch self {
        case .notConnected: tr("Non activé", "Not activated")
        case .pending: tr("Vérification en cours", "Verification in progress")
        case .verified: tr("Compte vérifié", "Account verified")
        }
    }

    var tint: Color {
        switch self {
        case .notConnected: Theme.inkSecondary
        case .pending: Theme.amber
        case .verified: Theme.green
        }
    }

    var background: Color {
        switch self {
        case .notConnected: Theme.navyTint
        case .pending: Theme.amberTint
        case .verified: Theme.greenTint
        }
    }

    var symbol: String {
        switch self {
        case .notConnected: "creditcard.trianglebadge.exclamationmark"
        case .pending: "clock.arrow.circlepath"
        case .verified: "checkmark.seal.fill"
        }
    }
}

/// Bank details of a club, entered by the bureau or the admin. They drive two
/// things: where the online payments are paid out, and the RIB a member can
/// download to pay by transfer.
struct ClubBankAccount: Codable, Sendable, Hashable {
    var holder: String = ""
    var iban: String = ""
    var bic: String = ""
    var bankName: String = ""
    var stripeStatus: StripeAccountStatus = .notConnected
    var stripeAccountId: String?
    var acceptsTransfer: Bool = true
    var acceptsCash: Bool = true
    var transferNote: String = ""
    var cashNote: String = ""
    var updatedAt: Date?
    var updatedById: UUID?

    /// IBAN without spaces, uppercased — the form used for validation.
    var compactIban: String {
        iban.uppercased().filter { $0.isLetter || $0.isNumber }
    }

    /// IBAN in readable groups of four, the way it is printed on a RIB.
    var formattedIban: String {
        Self.group(compactIban)
    }

    /// Last four digits only, for confirmation screens.
    var maskedIban: String {
        let compact = compactIban
        guard compact.count > 4 else { return compact }
        return "•••• •••• \(compact.suffix(4))"
    }

    /// Structural check plus the IBAN mod-97 checksum, so a typo is caught
    /// before the bureau saves wrong details.
    var isIbanValid: Bool {
        let compact = compactIban
        guard (15...34).contains(compact.count) else { return false }
        let prefix = compact.prefix(2)
        guard prefix.allSatisfy(\.isLetter),
              compact.dropFirst(2).prefix(2).allSatisfy(\.isNumber) else { return false }
        return Self.mod97(compact) == 1
    }

    var isBicValid: Bool {
        let compact = bic.uppercased().filter { $0.isLetter || $0.isNumber }
        return compact.count == 8 || compact.count == 11
    }

    /// True when the RIB can be published to members.
    var isComplete: Bool {
        !holder.trimmingCharacters(in: .whitespaces).isEmpty && isIbanValid && isBicValid
    }

    var canCollectOnline: Bool { stripeStatus == .verified }

    /// Payment methods a member can actually use with these settings.
    var availableMethods: [PaymentMethodKind] {
        var methods: [PaymentMethodKind] = []
        if canCollectOnline {
            methods.append(contentsOf: [.applePay, .googlePay, .card])
        }
        if acceptsTransfer && isComplete { methods.append(.transfer) }
        if acceptsCash { methods.append(.cash) }
        return methods
    }

    // MARK: - Helpers

    /// Formats free typing into IBAN groups of four while keeping it uppercase.
    nonisolated static func group(_ raw: String) -> String {
        let compact = raw.uppercased().filter { $0.isLetter || $0.isNumber }
        var output = ""
        for (index, character) in compact.enumerated() {
            if index > 0 && index % 4 == 0 { output.append(" ") }
            output.append(character)
        }
        return output
    }

    /// IBAN checksum: move the first four characters to the end, replace letters
    /// by their position value, then take the remainder modulo 97.
    nonisolated static func mod97(_ compact: String) -> Int {
        let rearranged = compact.dropFirst(4) + compact.prefix(4)
        var remainder = 0
        for character in rearranged {
            let chunk: String
            if let digit = character.wholeNumberValue, character.isNumber {
                chunk = String(digit)
            } else if let ascii = character.asciiValue, character.isLetter {
                chunk = String(Int(ascii) - 55)
            } else {
                return 0
            }
            for scalar in chunk {
                guard let value = scalar.wholeNumberValue else { return 0 }
                remainder = (remainder * 10 + value) % 97
            }
        }
        return remainder
    }
}

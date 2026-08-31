import SwiftUI
import UIKit

/// Builds the club's bank details as shareable text and as a one-page PDF the
/// member can download when he chooses to pay by bank transfer.
enum RIBDocument {
    /// Rows shown on screen and printed on the document.
    static func rows(club: Club, account: ClubBankAccount) -> [(label: String, value: String)] {
        [
            (tr("Bénéficiaire", "Payee"), account.holder),
            ("IBAN", account.formattedIban),
            ("BIC / SWIFT", account.bic.uppercased()),
            (tr("Banque", "Bank"), account.bankName),
            (tr("Club", "Club"), club.name)
        ].filter { !$0.value.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    /// Plain text version, used by "copy" actions and as a share fallback.
    static func text(club: Club, account: ClubBankAccount, reference: String?) -> String {
        var lines = [tr("Coordonnées bancaires · \(club.name)", "Bank details · \(club.name)")]
        lines.append(contentsOf: rows(club: club, account: account).map { "\($0.label): \($0.value)" })
        if let reference, !reference.isEmpty {
            lines.append(tr("Référence à indiquer : \(reference)", "Reference to quote: \(reference)"))
        }
        return lines.joined(separator: "\n")
    }

    /// Writes a printable RIB into the temporary directory and returns its URL,
    /// ready for `ShareLink`. Returns `nil` if the file cannot be written.
    static func makePDF(club: Club, account: ClubBankAccount, reference: String?) -> URL? {
        let page = CGRect(x: 0, y: 0, width: 595, height: 842)
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        let data = renderer.pdfData { context in
            context.beginPage()
            draw(club: club, account: account, reference: reference, in: page)
        }

        let safeName = club.shortName
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "en_US"))
            .replacingOccurrences(of: " ", with: "-")
            .filter { $0.isLetter || $0.isNumber || $0 == "-" }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("RIB-\(safeName.isEmpty ? "Club" : safeName).pdf")
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            print("RIBDocument: unable to write the PDF file")
            return nil
        }
    }

    // MARK: - Drawing

    private static func draw(
        club: Club,
        account: ClubBankAccount,
        reference: String?,
        in page: CGRect
    ) {
        let navy = UIColor(Theme.navy)
        let ink = UIColor(Theme.ink)
        let secondary = UIColor(Theme.inkSecondary)
        let margin: CGFloat = 56

        navy.setFill()
        UIBezierPath(rect: CGRect(x: 0, y: 0, width: page.width, height: 118)).fill()

        write(
            tr("Relevé d'identité bancaire", "Bank account details"),
            font: .systemFont(ofSize: 22, weight: .bold),
            color: .white,
            at: CGPoint(x: margin, y: 40),
            width: page.width - margin * 2
        )
        write(
            club.name.uppercased(),
            font: .systemFont(ofSize: 12, weight: .semibold),
            color: UIColor.white.withAlphaComponent(0.75),
            at: CGPoint(x: margin, y: 74),
            width: page.width - margin * 2
        )

        var cursor: CGFloat = 168
        for row in rows(club: club, account: account) {
            write(
                row.label.uppercased(),
                font: .systemFont(ofSize: 9, weight: .semibold),
                color: secondary,
                at: CGPoint(x: margin, y: cursor),
                width: page.width - margin * 2
            )
            let isIban = row.label == "IBAN"
            write(
                row.value,
                font: isIban
                    ? UIFont.monospacedSystemFont(ofSize: 17, weight: .semibold)
                    : .systemFont(ofSize: 15, weight: .medium),
                color: ink,
                at: CGPoint(x: margin, y: cursor + 16),
                width: page.width - margin * 2
            )
            cursor += 58

            UIColor(Theme.border).setFill()
            UIBezierPath(rect: CGRect(x: margin, y: cursor - 18, width: page.width - margin * 2, height: 1)).fill()
        }

        if let reference, !reference.isEmpty {
            cursor += 8
            UIColor(Theme.orangeTint).setFill()
            UIBezierPath(
                roundedRect: CGRect(x: margin, y: cursor, width: page.width - margin * 2, height: 66),
                cornerRadius: 12
            ).fill()
            write(
                tr("Référence à indiquer sur le virement", "Reference to quote on the transfer"),
                font: .systemFont(ofSize: 10, weight: .semibold),
                color: UIColor(Theme.amber),
                at: CGPoint(x: margin + 16, y: cursor + 14),
                width: page.width - margin * 2 - 32
            )
            write(
                reference,
                font: UIFont.monospacedSystemFont(ofSize: 16, weight: .bold),
                color: ink,
                at: CGPoint(x: margin + 16, y: cursor + 32),
                width: page.width - margin * 2 - 32
            )
            cursor += 90
        }

        if !account.transferNote.trimmingCharacters(in: .whitespaces).isEmpty {
            write(
                account.transferNote,
                font: .systemFont(ofSize: 12),
                color: secondary,
                at: CGPoint(x: margin, y: cursor),
                width: page.width - margin * 2
            )
        }

        write(
            tr(
                "Document généré par Assodarts le \(Fmt.mediumDate(.now)) · à conserver pour vos règlements.",
                "Document generated by Assodarts on \(Fmt.mediumDate(.now)) · keep it for your payments."
            ),
            font: .systemFont(ofSize: 9),
            color: secondary,
            at: CGPoint(x: margin, y: page.height - 62),
            width: page.width - margin * 2
        )
    }

    private static func write(
        _ string: String,
        font: UIFont,
        color: UIColor,
        at origin: CGPoint,
        width: CGFloat
    ) {
        let attributed = NSAttributedString(
            string: string,
            attributes: [.font: font, .foregroundColor: color]
        )
        attributed.draw(in: CGRect(x: origin.x, y: origin.y, width: width, height: 400))
    }
}

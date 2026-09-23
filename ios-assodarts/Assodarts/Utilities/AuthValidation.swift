import Foundation

enum AuthValidation {
    static let minimumPasswordLength = 10

    static func validateNewPassword(_ password: String) -> String? {
        let hasLetter = password.rangeOfCharacter(from: .letters) != nil
        let hasDigit = password.rangeOfCharacter(from: .decimalDigits) != nil

        guard password.count >= minimumPasswordLength, hasLetter, hasDigit else {
            return tr("the_password_must_be_at_least_6_characters_long")
        }
        return nil
    }

    static func validatePasswordConfirmation(password: String, confirmation: String) -> String? {
        password == confirmation ? nil : tr("the_two_passwords_do_not_match")
    }
}

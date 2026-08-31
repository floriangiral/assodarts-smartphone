import SwiftUI

/// Keyboard behaviour shared by every form of the app.
///
/// The keyboard has to follow the interface language (dictation, autocorrection,
/// AZERTY vs QWERTY suggestions), never cover the field being edited, and always
/// offer a way out — including on numeric keypads, which have no return key.
enum KeyboardKit {
    /// Type of content a field expects, driving keyboard layout and hints.
    enum Field {
        case name
        case email
        case password
        case phone
        case licence
        case code
        case amount
        case freeText
    }
}

private struct KeyboardFieldModifier: ViewModifier {
    @Environment(Localization.self) private var localization
    let field: KeyboardKit.Field
    let submitLabel: SubmitLabel

    func body(content: Content) -> some View {
        content
            .submitLabel(submitLabel)
            .environment(\.locale, localization.locale)
            .modifier(FieldTraits(field: field))
    }
}

private struct FieldTraits: ViewModifier {
    let field: KeyboardKit.Field

    func body(content: Content) -> some View {
        switch field {
        case .name:
            content
                .keyboardType(.default)
                .textContentType(.name)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
        case .email:
            content
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        case .password:
            content
                .textContentType(.password)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        case .phone:
            content
                .keyboardType(.phonePad)
                .textContentType(.telephoneNumber)
        case .licence:
            content
                .keyboardType(.numbersAndPunctuation)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
        case .code:
            content
                .keyboardType(.asciiCapable)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
        case .amount:
            content
                .keyboardType(.decimalPad)
        case .freeText:
            content
                .keyboardType(.default)
                .textInputAutocapitalization(.sentences)
        }
    }
}

private struct KeyboardDoneBar: ViewModifier {
    let isVisible: Bool
    let dismiss: () -> Void

    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                if isVisible {
                    Spacer()
                    Button(tr("Terminé", "Done"), action: dismiss)
                        .fontWeight(.semibold)
                }
            }
        }
    }
}

extension View {
    /// Configures a text field's keyboard: layout, content hints, capitalisation
    /// and the language used for suggestions and dictation.
    func keyboardField(
        _ field: KeyboardKit.Field,
        submit: SubmitLabel = .next
    ) -> some View {
        modifier(KeyboardFieldModifier(field: field, submitLabel: submit))
    }

    /// Adds a "Done" button above the keyboard. Required for numeric keypads,
    /// which have no return key to dismiss them.
    func keyboardDoneBar(isVisible: Bool, dismiss: @escaping () -> Void) -> some View {
        modifier(KeyboardDoneBar(isVisible: isVisible, dismiss: dismiss))
    }

    /// Lets the user swipe the keyboard away and tap outside a field to close it.
    func keyboardDismissable() -> some View {
        self
            .scrollDismissesKeyboard(.interactively)
            .contentShape(.rect)
    }
}

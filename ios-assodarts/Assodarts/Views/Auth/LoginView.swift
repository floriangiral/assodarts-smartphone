import SwiftUI

/// Entry point of the app: sign in against the club server or create an account.
struct LoginView: View {
    @Environment(AppStore.self) private var store

    @State private var intent: Intent = .signIn
    @State private var firstName: String = ""
    @State private var lastName: String = ""
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var passwordConfirmation: String = ""
    @State private var errorMessage: String?
    @State private var infoMessage: String?
    @State private var isSubmitting: Bool = false
    @FocusState private var focusedField: Field?

    private enum Intent: String, CaseIterable, Identifiable {
        case signIn
        case signUp

        var id: String { rawValue }

        var label: String {
            switch self {
            case .signIn: tr("sign_in")
            case .signUp: tr("sign_up")
            }
        }
    }

    private enum Field: Hashable {
        case firstName
        case lastName
        case email
        case password
        case passwordConfirmation
    }

    private var canSubmit: Bool {
        guard !isSubmitting,
              !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty else { return false }
        guard intent == .signUp else { return true }
        return !firstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !lastName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !passwordConfirmation.isEmpty
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 24) {
                    header
                    form
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 40)
            }
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: focusedField != nil) { focusedField = nil }
            .onChange(of: focusedField) { _, newValue in
                guard let newValue else { return }
                withAnimation {
                    proxy.scrollTo(newValue, anchor: .center)
                }
            }
        }
        .assoCanvas()
        .overlay(alignment: .topTrailing) {
            LanguageMenu()
                .padding(.horizontal, 20)
                .padding(.top, 8)
        }
        .onAppear {
            if let notice = store.authNotice {
                infoMessage = notice
                store.authNotice = nil
            }
        }
    }

    private var header: some View {
        VStack(spacing: 14) {
            BrandMark(size: 76)
            Text("Assodarts")
                .font(.largeTitle.bold())
                .foregroundStyle(Theme.ink)
            Text(tr("everything_your_darts_club_needs_brought_together_in_one"))
            .font(.subheadline)
            .multilineTextAlignment(.center)
            .foregroundStyle(Theme.inkSecondary)
        }
        .padding(.bottom, 8)
    }

    private var form: some View {
        VStack(spacing: 14) {
            Picker("", selection: $intent) {
                ForEach(Intent.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: intent) { _, _ in
                errorMessage = nil
                infoMessage = nil
                passwordConfirmation = ""
            }

            if intent == .signUp {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: tr("first_name"))
                        TextField(tr("alex"), text: $firstName)
                            .textContentType(.givenName)
                            .focused($focusedField, equals: .firstName)
                            .foregroundStyle(Theme.ink)
                            .assoFieldSurface()
                    }
                    .id(Field.firstName)
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: tr("last_name"))
                        TextField(tr("smith"), text: $lastName)
                            .textContentType(.familyName)
                            .focused($focusedField, equals: .lastName)
                            .foregroundStyle(Theme.ink)
                            .assoFieldSurface()
                    }
                    .id(Field.lastName)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("email_address"))
                TextField(tr("name_club_com"), text: $email)
                    .keyboardField(.loginEmail, submit: .next)
                    .focused($focusedField, equals: .email)
                    .onSubmit { focusedField = .password }
                    .foregroundStyle(Theme.ink)
                    .assoFieldSurface()
            }
            .id(Field.email)

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("password"))
                SecureField("••••••", text: $password)
                    .keyboardField(
                        intent == .signIn ? .password : .newPassword,
                        submit: intent == .signIn ? .go : .next
                    )
                    .focused($focusedField, equals: .password)
                    .onSubmit {
                        if intent == .signUp {
                            focusedField = .passwordConfirmation
                        } else {
                            submit()
                        }
                    }
                    .foregroundStyle(Theme.ink)
                    .assoFieldSurface()
                if intent == .signUp {
                    Text(tr("at_least_6_characters"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .id(Field.password)

            if intent == .signUp {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: tr("confirm_the_password"))
                    SecureField("••••••", text: $passwordConfirmation)
                        .keyboardField(.newPassword, submit: .go)
                        .focused($focusedField, equals: .passwordConfirmation)
                        .onSubmit(submit)
                        .foregroundStyle(Theme.ink)
                        .assoFieldSurface()
                }
                .id(Field.passwordConfirmation)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if let infoMessage {
                Label(infoMessage, systemImage: "envelope.badge.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.navy)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }

            PrimaryButton(
                title: isSubmitting
                    ? tr("signing_in")
                    : intent.label,
                symbol: isSubmitting ? "ellipsis" : "arrow.right",
                isEnabled: canSubmit,
                action: submit
            )
            .padding(.top, 4)

            if intent == .signIn {
                Button(tr("forgot_your_password"), action: resetPassword)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.inkSecondary)
                    .disabled(isSubmitting)
            }
        }
        .assoCard(padding: 20)
        .animation(.spring(response: 0.32, dampingFraction: 0.88), value: intent)
    }

    // MARK: - Actions

    private func submit() {
        focusedField = nil
        guard canSubmit else { return }
        if intent == .signUp {
            if let message = AuthValidation.validateNewPassword(password) {
                errorMessage = message
                return
            }
            if let message = AuthValidation.validatePasswordConfirmation(
                password: password,
                confirmation: passwordConfirmation
            ) {
                errorMessage = message
                return
            }
        }
        isSubmitting = true
        errorMessage = nil
        infoMessage = nil

        Task { @MainActor in
            let result: String?
            switch intent {
            case .signIn:
                result = await store.signInRemote(email: email, password: password)
            case .signUp:
                result = await store.signUpRemote(
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: password,
                    phone: ""
                )
            }

            withAnimation(.easeInOut(duration: 0.2)) {
                errorMessage = result
                infoMessage = store.authNotice
                store.authNotice = nil
                isSubmitting = false
            }
        }
    }

    private func resetPassword() {
        focusedField = nil
        isSubmitting = true
        Task { @MainActor in
            let message = await store.sendPasswordReset(email: email)
            withAnimation(.easeInOut(duration: 0.2)) {
                infoMessage = message
                errorMessage = nil
                isSubmitting = false
            }
        }
    }
}

#Preview {
    LoginView()
        .environment(AppStore())
        .environment(Localization.shared)
}

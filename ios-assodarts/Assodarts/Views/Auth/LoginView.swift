import SwiftUI

/// Entry point of the app: sign in against the club server or create an account.
struct LoginView: View {
    @Environment(AppStore.self) private var store

    @State private var intent: Intent = .signIn
    @State private var firstName: String = ""
    @State private var lastName: String = ""
    @State private var email: String = ""
    @State private var phone: String = ""
    @State private var password: String = ""
    @State private var clubName: String = ""
    @State private var errorMessage: String?
    @State private var infoMessage: String?
    @State private var isSubmitting: Bool = false
    @FocusState private var focusedField: Field?

    private enum Intent: String, CaseIterable, Identifiable {
        case signIn
        case signUp
        case createClub

        var id: String { rawValue }

        /// Top-level choices shown in the main segmented control.
        static var topLevelCases: [Intent] { [.signIn, .signUp] }

        var label: String {
            switch self {
            case .signIn: tr("sign_in")
            case .signUp: tr("sign_up")
            case .createClub: tr("create_my_club")
            }
        }

        /// Distinct phrasing for the invited-vs-founder sub-choice shown once
        /// "Sign up" is selected — clearer there than the generic `label`.
        var signUpChoiceLabel: String {
            switch self {
            case .signUp: tr("i_was_invited_by_my_club")
            case .createClub: tr("i_m_creating_my_club")
            case .signIn: label
            }
        }
    }

    /// The top segmented control only ever shows "Sign in"/"Sign up"; picking
    /// between the invited/founder sub-choice happens one level down and
    /// keeps this binding on `.signUp` so the top control stays highlighted.
    private var topIntentBinding: Binding<Intent> {
        Binding(
            get: { intent == .createClub ? .signUp : intent },
            set: { intent = $0 }
        )
    }

    private enum Field: Hashable {
        case firstName
        case lastName
        case email
        case phone
        case clubName
        case password
    }

    var body: some View {
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
        .assoCanvas()
        .overlay(alignment: .topTrailing) {
            LanguageMenu()
                .padding(.horizontal, 20)
                .padding(.top, 8)
        }
        .onTapGesture { focusedField = nil }
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
            Picker("", selection: topIntentBinding) {
                ForEach(Intent.topLevelCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: intent) { _, _ in
                errorMessage = nil
                infoMessage = nil
            }

            if intent == .signUp || intent == .createClub {
                Picker("", selection: $intent) {
                    ForEach([Intent.signUp, .createClub]) { option in
                        Text(option.signUpChoiceLabel).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if intent == .signUp || intent == .createClub {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: tr("first_name"))
                        TextField(tr("alex"), text: $firstName)
                            .textContentType(.givenName)
                            .focused($focusedField, equals: .firstName)
                            .foregroundStyle(Theme.ink)
                            .padding(14)
                            .background(Theme.canvas, in: .rect(cornerRadius: Theme.controlRadius))
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: tr("last_name"))
                        TextField(tr("smith"), text: $lastName)
                            .textContentType(.familyName)
                            .focused($focusedField, equals: .lastName)
                            .foregroundStyle(Theme.ink)
                            .padding(14)
                            .background(Theme.canvas, in: .rect(cornerRadius: Theme.controlRadius))
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("email_address"))
                TextField(tr("name_club_com"), text: $email)
                    .keyboardField(.email, submit: .next)
                    .focused($focusedField, equals: .email)
                    .onSubmit { focusedField = .password }
                    .foregroundStyle(Theme.ink)
                    .padding(14)
                    .background(Theme.canvas, in: .rect(cornerRadius: Theme.controlRadius))
            }

            if intent == .signUp || intent == .createClub {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: tr("phone_optional"))
                    TextField("06 12 34 56 78", text: $phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .focused($focusedField, equals: .phone)
                        .foregroundStyle(Theme.ink)
                        .padding(14)
                        .background(Theme.canvas, in: .rect(cornerRadius: Theme.controlRadius))
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if intent == .createClub {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: tr("club_name"))
                    TextField(tr("lyon_darts_club"), text: $clubName)
                        .focused($focusedField, equals: .clubName)
                        .onSubmit { focusedField = .password }
                        .foregroundStyle(Theme.ink)
                        .padding(14)
                        .background(Theme.canvas, in: .rect(cornerRadius: Theme.controlRadius))
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("password"))
                SecureField("••••••", text: $password)
                    .keyboardField(.password, submit: .go)
                    .focused($focusedField, equals: .password)
                    .onSubmit(submit)
                    .foregroundStyle(Theme.ink)
                    .padding(14)
                    .background(Theme.canvas, in: .rect(cornerRadius: Theme.controlRadius))
                if intent == .signUp || intent == .createClub {
                    Text(tr("at_least_6_characters"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
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
                isEnabled: !isSubmitting && !email.isEmpty && !password.isEmpty,
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
        guard !isSubmitting else { return }
        isSubmitting = true
        errorMessage = nil
        infoMessage = nil

        Task {
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
                    phone: phone
                )
            case .createClub:
                result = await store.signUpAndCreateClub(
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: password,
                    phone: phone,
                    clubName: clubName
                )
            }

            withAnimation(.easeInOut(duration: 0.2)) {
                errorMessage = result
                isSubmitting = false
            }
        }
    }

    private func resetPassword() {
        focusedField = nil
        isSubmitting = true
        Task {
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

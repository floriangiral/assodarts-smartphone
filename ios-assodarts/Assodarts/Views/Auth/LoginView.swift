import SwiftUI

/// Entry point of the app: sign in against the club server, create an account,
/// or explore the app with the local demo data.
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
    @State private var showsDemoAccounts: Bool = false
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
            case .signIn: tr("Se connecter", "Sign in")
            case .signUp: tr("Créer un compte", "Sign up")
            case .createClub: tr("Créer mon club", "Create my club")
            }
        }

        /// Distinct phrasing for the invited-vs-founder sub-choice shown once
        /// "Sign up" is selected — clearer there than the generic `label`.
        var signUpChoiceLabel: String {
            switch self {
            case .signUp: tr("J'ai été invité(e) par mon club", "I was invited by my club")
            case .createClub: tr("Je crée le club de mon association", "I'm creating my club")
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

    private var demoAccounts: [Member] {
        let wanted = ["admin@fcl-lyon.fr", "bureau@fcl-lyon.fr", "sophie@fcl-lyon.fr", "dev@assodarts.fr"]
        return wanted.compactMap { mail in
            store.db.members.first { $0.email == mail }
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                header
                form
                demoSection
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
    }

    private var header: some View {
        VStack(spacing: 14) {
            BrandMark(size: 76)
            Text("Assodarts")
                .font(.largeTitle.bold())
                .foregroundStyle(Theme.ink)
            Text(tr(
                "La gestion de votre club de fléchettes,\nréunie dans une seule application.",
                "Everything your darts club needs,\nbrought together in one app."
            ))
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
                        SectionLabel(text: tr("Prénom", "First name"))
                        TextField(tr("Camille", "Alex"), text: $firstName)
                            .textContentType(.givenName)
                            .focused($focusedField, equals: .firstName)
                            .foregroundStyle(Theme.ink)
                            .padding(14)
                            .background(Theme.canvas, in: .rect(cornerRadius: 12))
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: tr("Nom", "Last name"))
                        TextField(tr("Dupont", "Smith"), text: $lastName)
                            .textContentType(.familyName)
                            .focused($focusedField, equals: .lastName)
                            .foregroundStyle(Theme.ink)
                            .padding(14)
                            .background(Theme.canvas, in: .rect(cornerRadius: 12))
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("Adresse email", "Email address"))
                TextField(tr("prenom@club.fr", "name@club.com"), text: $email)
                    .keyboardField(.email, submit: .next)
                    .focused($focusedField, equals: .email)
                    .onSubmit { focusedField = .password }
                    .foregroundStyle(Theme.ink)
                    .padding(14)
                    .background(Theme.canvas, in: .rect(cornerRadius: 12))
            }

            if intent == .signUp || intent == .createClub {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: tr("Téléphone (facultatif)", "Phone (optional)"))
                    TextField("06 12 34 56 78", text: $phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .focused($focusedField, equals: .phone)
                        .foregroundStyle(Theme.ink)
                        .padding(14)
                        .background(Theme.canvas, in: .rect(cornerRadius: 12))
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if intent == .createClub {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: tr("Nom du club", "Club name"))
                    TextField(tr("Fléchettes Club Lyon", "Lyon Darts Club"), text: $clubName)
                        .focused($focusedField, equals: .clubName)
                        .onSubmit { focusedField = .password }
                        .foregroundStyle(Theme.ink)
                        .padding(14)
                        .background(Theme.canvas, in: .rect(cornerRadius: 12))
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("Mot de passe", "Password"))
                SecureField("••••••", text: $password)
                    .keyboardField(.password, submit: .go)
                    .focused($focusedField, equals: .password)
                    .onSubmit(submit)
                    .foregroundStyle(Theme.ink)
                    .padding(14)
                    .background(Theme.canvas, in: .rect(cornerRadius: 12))
                if intent == .signUp || intent == .createClub {
                    Text(tr("6 caractères minimum.", "At least 6 characters."))
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
                    ? tr("Connexion…", "Signing in…")
                    : intent.label,
                symbol: isSubmitting ? "ellipsis" : "arrow.right",
                isEnabled: !isSubmitting && !email.isEmpty && !password.isEmpty,
                action: submit
            )
            .padding(.top, 4)

            if intent == .signIn {
                Button(tr("Mot de passe oublié ?", "Forgot your password?"), action: resetPassword)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.inkSecondary)
                    .disabled(isSubmitting)
            }
        }
        .assoCard(padding: 20)
        .animation(.spring(response: 0.32, dampingFraction: 0.88), value: intent)
    }

    private var demoSection: some View {
        VStack(spacing: 12) {
            Button {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                    showsDemoAccounts.toggle()
                }
            } label: {
                HStack {
                    Image(systemName: "person.2.badge.key")
                    Text(tr("Explorer en mode démo (hors ligne)", "Explore in demo mode (offline)"))
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Image(systemName: "chevron.down")
                        .rotationEffect(.degrees(showsDemoAccounts ? 180 : 0))
                        .font(.caption.weight(.bold))
                }
                .foregroundStyle(Theme.navy)
            }
            .buttonStyle(.plain)

            if showsDemoAccounts {
                VStack(spacing: 10) {
                    Text(tr(
                        "Données fictives stockées sur cet iPhone, sans connexion au serveur.",
                        "Sample data kept on this iPhone only, with no server connection."
                    ))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                    ForEach(demoAccounts) { account in
                        Button {
                            store.mode = .demo
                            store.signIn(as: account)
                        } label: {
                            HStack(spacing: 12) {
                                AvatarView(initials: account.initials, photoData: account.photoData, size: 38)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(account.fullName)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(Theme.ink)
                                    Text(account.email)
                                        .font(.caption)
                                        .foregroundStyle(Theme.inkSecondary)
                                }
                                Spacer()
                                RoleBadge(role: account.role)
                            }
                            .padding(.vertical, 8)
                        }
                        .buttonStyle(.plain)

                        if account.id != demoAccounts.last?.id {
                            Divider().overlay(Theme.border)
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .assoCard(padding: 18)
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

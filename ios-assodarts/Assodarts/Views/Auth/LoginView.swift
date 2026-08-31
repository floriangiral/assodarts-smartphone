import SwiftUI

/// Entry point of the app: sign in, then land on the role-adapted space.
struct LoginView: View {
    @Environment(AppStore.self) private var store

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var errorMessage: String?
    @State private var isSubmitting: Bool = false
    @State private var showsDemoAccounts: Bool = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email
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
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("Adresse email", "Email address"))
                TextField(tr("prenom@club.fr", "name@club.com"), text: $email)
                    .keyboardField(.email, submit: .next)
                    .focused($focusedField, equals: .email)
                    .onSubmit { focusedField = .password }
                    .padding(14)
                    .background(Theme.canvas, in: .rect(cornerRadius: 12))
            }

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("Mot de passe", "Password"))
                SecureField("••••••", text: $password)
                    .keyboardField(.password, submit: .go)
                    .focused($focusedField, equals: .password)
                    .onSubmit(submit)
                    .padding(14)
                    .background(Theme.canvas, in: .rect(cornerRadius: 12))
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }

            PrimaryButton(
                title: tr("Se connecter", "Sign in"),
                symbol: "arrow.right",
                isEnabled: !isSubmitting,
                action: submit
            )
            .padding(.top, 4)

            Button(tr("Mot de passe oublié ?", "Forgot your password?")) {
                errorMessage = tr(
                    "Contactez le bureau de votre club pour réinitialiser votre accès.",
                    "Contact your club committee to reset your access."
                )
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(Theme.inkSecondary)
        }
        .assoCard(padding: 20)
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
                    Text(tr("Comptes de démonstration", "Demo accounts"))
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
                    ForEach(demoAccounts) { account in
                        Button {
                            email = account.email
                            password = account.password
                            submit()
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

                    Text(tr("Mot de passe : demo", "Password: demo"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .assoCard(padding: 18)
    }

    private func submit() {
        focusedField = nil
        isSubmitting = true
        withAnimation(.easeInOut(duration: 0.2)) {
            errorMessage = store.signIn(email: email, password: password)
        }
        isSubmitting = false
    }
}

#Preview {
    LoginView()
        .environment(AppStore())
        .environment(Localization.shared)
}

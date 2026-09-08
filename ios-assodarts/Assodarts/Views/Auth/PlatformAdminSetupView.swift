import FirebaseAuth
import SwiftUI

/// Shown only while the platform has no administrator at all: it creates the
/// very first one. Once claimed, this screen is never reachable again.
struct PlatformAdminSetupView: View {
    @Environment(AppStore.self) private var store

    @State private var firstName: String = ""
    @State private var lastName: String = ""
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var confirmation: String = ""
    @State private var errorMessage: String?
    @State private var isSubmitting: Bool = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case firstName
        case lastName
        case email
        case password
        case confirmation
    }

    private var canSubmit: Bool {
        !isSubmitting && !email.isEmpty && !password.isEmpty && !confirmation.isEmpty
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
    }

    private var header: some View {
        VStack(spacing: 14) {
            BrandMark(size: 76)
            Text(tr("first_launch"))
                .font(.caption.weight(.bold))
                .tracking(0.8)
                .foregroundStyle(Theme.orange)
            Text(tr("create_the_platform_administrator"))
                .font(.largeTitle.bold())
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.ink)
            Text(tr("no_platform_administrator_exists_yet_this_first_account_"))
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.inkSecondary)
        }
        .padding(.bottom, 8)
    }

    private var form: some View {
        VStack(spacing: 14) {
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

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("password"))
                SecureField("••••••", text: $password)
                    .keyboardField(.password, submit: .next)
                    .focused($focusedField, equals: .password)
                    .onSubmit { focusedField = .confirmation }
                    .foregroundStyle(Theme.ink)
                    .padding(14)
                    .background(Theme.canvas, in: .rect(cornerRadius: Theme.controlRadius))
                Text(tr("at_least_6_characters"))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: tr("confirm_the_password"))
                SecureField("••••••", text: $confirmation)
                    .keyboardField(.password, submit: .go)
                    .focused($focusedField, equals: .confirmation)
                    .onSubmit(submit)
                    .foregroundStyle(Theme.ink)
                    .padding(14)
                    .background(Theme.canvas, in: .rect(cornerRadius: Theme.controlRadius))
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }

            PrimaryButton(
                title: isSubmitting ? tr("creating") : tr("create_the_administrator_account"),
                symbol: isSubmitting ? "ellipsis" : "checkmark.shield.fill",
                isEnabled: canSubmit,
                action: submit
            )
            .padding(.top, 4)
        }
        .assoCard(padding: 20)
    }

    // MARK: - Actions

    private func submit() {
        focusedField = nil
        guard canSubmit else { return }

        let first = firstName.trimmingCharacters(in: .whitespacesAndNewlines)
        let last = lastName.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        guard !first.isEmpty, !last.isEmpty else {
            errorMessage = tr("enter_your_first_and_last_name")
            return
        }
        guard password.count >= 6 else {
            errorMessage = tr("the_password_must_be_at_least_6_characters_long")
            return
        }
        guard password == confirmation else {
            errorMessage = tr("the_two_passwords_do_not_match")
            return
        }

        isSubmitting = true
        errorMessage = nil

        Task {
            await create(firstName: first, lastName: last, email: normalized)
            isSubmitting = false
        }
    }

    private func create(firstName: String, lastName: String, email: String) async {
        let result: AuthDataResult
        do {
            result = try await Backend.auth.createUser(withEmail: email, password: password)
        } catch {
            errorMessage = friendlyMessage(for: error)
            return
        }

        do {
            try await RemoteRepository.claimPlatformAdmin()
        } catch {
            // Another device won the race: drop the orphan auth user and send
            // this one to the normal sign-in screen.
            try? await result.user.delete()
            store.confirmPlatformAdminExists()
            store.authNotice = BackendError.platformAdminAlreadyExists.errorDescription
            return
        }

        do {
            let userId = UUID()
            try await RemoteRepository.createSelfMember(
                userId: userId,
                authUid: result.user.uid,
                firstName: firstName,
                lastName: lastName,
                email: email,
                phone: nil
            )
            store.isPlatformAdmin = true
            store.confirmPlatformAdminExists()
            // The account has no club yet, so `loadRemote` reports
            // `noMembership`; the platform admin lands on the developer
            // console anyway, so that message is not an error here.
            _ = await store.loadRemote(userId: userId)
            await store.loadPlatformData()
        } catch {
            errorMessage = friendlyMessage(for: error)
        }
    }
}

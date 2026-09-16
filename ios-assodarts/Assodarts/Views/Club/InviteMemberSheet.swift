import SwiftUI

/// Registers a pending invitation for an email address. The member profile is
/// created by the invited person when they sign up with that email.
struct InviteMemberSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var email: String = ""
    @State private var showsConfirmation: Bool = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email
    }

    private var canInvite: Bool {
        email.trimmingCharacters(in: .whitespacesAndNewlines).contains("@")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("email_address")) {
                    TextField(tr("email"), text: $email)
                        .keyboardField(.email, submit: .done)
                        .focused($focusedField, equals: .email)
                        .onSubmit { focusedField = nil }
                        .foregroundStyle(Theme.ink)
                }

                Section {
                    Button {
                        invite()
                    } label: {
                        Label(tr("send_invitation"), systemImage: "paperplane.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(!canInvite)
                } footer: {
                    Text(tr("the_member_receives_an_invitation_email_with_a_temporary"))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: focusedField != nil) { focusedField = nil }
            .navigationTitle(tr("invite_a_member"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
            }
            .alert(tr("invitation_sent"), isPresented: $showsConfirmation) {
                Button(tr("done")) { dismiss() }
            } message: {
                Text(tr("the_member_receives_an_invitation_email_with_a_temporary"))
            }
        }
    }

    private func invite() {
        guard let club = store.currentClub else { return }
        store.inviteMember(
            email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            to: club.id
        )
        showsConfirmation = true
    }
}

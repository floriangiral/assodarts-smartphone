import SwiftUI

/// Invite a new member by email — the account is created with the "Membre" role.
struct InviteMemberSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var firstName: String = ""
    @State private var lastName: String = ""
    @State private var email: String = ""
    @State private var role: Role = .membre
    @State private var isLicensed: Bool = false
    @State private var licenceNumber: String = ""
    @State private var showsConfirmation: Bool = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case firstName
        case lastName
        case email
        case licence
    }

    private var canInvite: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lastName.trimmingCharacters(in: .whitespaces).isEmpty
            && email.contains("@")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("Identité", "Identity")) {
                    TextField(tr("Prénom", "First name"), text: $firstName)
                        .keyboardField(.name, submit: .next)
                        .focused($focusedField, equals: .firstName)
                        .onSubmit { focusedField = .lastName }
                    TextField(tr("Nom", "Last name"), text: $lastName)
                        .keyboardField(.name, submit: .next)
                        .focused($focusedField, equals: .lastName)
                        .onSubmit { focusedField = .email }
                    TextField(tr("Email", "Email"), text: $email)
                        .keyboardField(.email, submit: .done)
                        .focused($focusedField, equals: .email)
                        .onSubmit { focusedField = nil }
                }

                Section(tr("Licence", "Licence")) {
                    Toggle(tr("Licencié FFD", "FFD licensed"), isOn: $isLicensed)
                    if isLicensed {
                        TextField(tr("N° de licence", "Licence number"), text: $licenceNumber)
                            .keyboardField(.licence, submit: .done)
                            .focused($focusedField, equals: .licence)
                    }
                }

                if store.currentUser?.role.canManageRoles == true {
                    Section(tr("Rôle", "Role")) {
                        Picker(tr("Rôle", "Role"), selection: $role) {
                            ForEach(Role.clubRoles) { role in
                                Text(role.label).tag(role)
                            }
                        }
                        .pickerStyle(.segmented)
                        Text(role.permissionSummary)
                            .font(.caption)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }

                Section {
                    Button {
                        invite()
                    } label: {
                        Label(tr("Envoyer l'invitation", "Send invitation"), systemImage: "paperplane.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(!canInvite)
                } footer: {
                    Text(tr(
                        "Le membre reçoit un email d'invitation avec un mot de passe provisoire. "
                            + "Mot de passe de démonstration : demo",
                        "The member receives an invitation email with a temporary password. "
                            + "Demo password: demo"
                    ))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: focusedField != nil) { focusedField = nil }
            .navigationTitle(tr("Inviter un membre", "Invite a member"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("Annuler", "Cancel")) { dismiss() }
                }
            }
            .alert(tr("Invitation envoyée", "Invitation sent"), isPresented: $showsConfirmation) {
                Button(tr("Terminé", "Done")) { dismiss() }
            } message: {
                Text(tr(
                    "\(firstName) \(lastName) a été ajouté au club et recevra son invitation par email.",
                    "\(firstName) \(lastName) has been added to the club and will receive an email invitation."
                ))
            }
        }
    }

    private func invite() {
        guard let club = store.currentClub else { return }
        let member = Member(
            clubId: club.id,
            firstName: firstName.trimmingCharacters(in: .whitespaces),
            lastName: lastName.trimmingCharacters(in: .whitespaces),
            email: email.trimmingCharacters(in: .whitespaces).lowercased(),
            role: role,
            isLicensed: isLicensed,
            licenceNumber: isLicensed ? licenceNumber : "",
            joinedAt: .now
        )
        store.addMember(member)
        showsConfirmation = true
    }
}

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

    private var canInvite: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lastName.trimmingCharacters(in: .whitespaces).isEmpty
            && email.contains("@")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identité") {
                    TextField("Prénom", text: $firstName)
                    TextField("Nom", text: $lastName)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section("Licence") {
                    Toggle("Licencié FFD", isOn: $isLicensed)
                    if isLicensed {
                        TextField("N° de licence", text: $licenceNumber)
                            .keyboardType(.numbersAndPunctuation)
                    }
                }

                if store.currentUser?.role.canManageRoles == true {
                    Section("Rôle") {
                        Picker("Rôle", selection: $role) {
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
                        Label("Envoyer l'invitation", systemImage: "paperplane.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(!canInvite)
                } footer: {
                    Text("Le membre reçoit un email d'invitation avec un mot de passe provisoire. "
                        + "Mot de passe de démonstration : demo")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .navigationTitle("Inviter un membre")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
            .alert("Invitation envoyée", isPresented: $showsConfirmation) {
                Button("Terminé") { dismiss() }
            } message: {
                Text("\(firstName) \(lastName) a été ajouté au club et recevra son invitation par email.")
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

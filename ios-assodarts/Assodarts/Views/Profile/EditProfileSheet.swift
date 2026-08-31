import SwiftUI
import PhotosUI

/// Edit identity, contact details and per-category notification preferences.
struct EditProfileSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var draft: Member?
    @State private var photoItem: PhotosPickerItem?
    @State private var hasBirthDate: Bool = false
    @State private var birthDate: Date = .now
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case firstName
        case lastName
        case email
        case phone
    }

    var body: some View {
        NavigationStack {
            Group {
                if let draft {
                    form(for: draft)
                } else {
                    ProgressView()
                }
            }
            .keyboardDoneBar(isVisible: focusedField != nil) { focusedField = nil }
            .navigationTitle(tr("Modifier mon profil", "Edit my profile"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("Annuler", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("Enregistrer", "Save"), action: save)
                        .fontWeight(.semibold)
                        .disabled(draft == nil)
                }
            }
            .task(id: photoItem) {
                guard let photoItem,
                      let data = try? await photoItem.loadTransferable(type: Data.self) else { return }
                draft?.photoData = data
            }
            .onAppear {
                guard draft == nil, let user = store.currentUser else { return }
                draft = user
                if let date = user.birthDate {
                    hasBirthDate = true
                    birthDate = date
                }
            }
        }
    }

    private func form(for member: Member) -> some View {
        Form {
            Section {
                VStack(spacing: 12) {
                    AvatarView(initials: member.initials, photoData: member.photoData, size: 88)
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label(tr("Changer la photo", "Change photo"), systemImage: "camera.fill")
                            .font(.subheadline.weight(.semibold))
                    }
                    if member.photoData != nil {
                        Button(tr("Retirer la photo", "Remove photo"), role: .destructive) {
                            draft?.photoData = nil
                            photoItem = nil
                        }
                        .font(.caption)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            Section(tr("Identité", "Identity")) {
                TextField(tr("Prénom", "First name"), text: Binding(
                    get: { draft?.firstName ?? "" },
                    set: { draft?.firstName = $0 }
                ))
                .keyboardField(.name, submit: .next)
                .focused($focusedField, equals: .firstName)
                .onSubmit { focusedField = .lastName }

                TextField(tr("Nom", "Last name"), text: Binding(
                    get: { draft?.lastName ?? "" },
                    set: { draft?.lastName = $0 }
                ))
                .keyboardField(.name, submit: .next)
                .focused($focusedField, equals: .lastName)
                .onSubmit { focusedField = .email }

                Toggle(tr("Date de naissance", "Date of birth"), isOn: $hasBirthDate)
                if hasBirthDate {
                    DatePicker(tr("Né(e) le", "Born on"), selection: $birthDate, displayedComponents: .date)
                }
            }

            Section {
                TextField(tr("Email", "Email"), text: Binding(
                    get: { draft?.email ?? "" },
                    set: { draft?.email = $0 }
                ))
                .keyboardField(.email, submit: .next)
                .focused($focusedField, equals: .email)
                .onSubmit { focusedField = .phone }

                TextField(tr("Téléphone", "Phone"), text: Binding(
                    get: { draft?.phone ?? "" },
                    set: { draft?.phone = $0 }
                ))
                .keyboardField(.phone, submit: .done)
                .focused($focusedField, equals: .phone)
            } header: {
                Text(tr("Contact", "Contact"))
            } footer: {
                Text(tr("Visible par le bureau du club.", "Visible to the club committee."))
            }

            Section {
                Toggle(tr("Annonces du club", "Club announcements"), isOn: Binding(
                    get: { draft?.notifyAnnouncements ?? true },
                    set: { draft?.notifyAnnouncements = $0 }
                ))
                Toggle(tr("Événements et convocations", "Events and call-ups"), isOn: Binding(
                    get: { draft?.notifyEvents ?? true },
                    set: { draft?.notifyEvents = $0 }
                ))
                Toggle(tr("Appels à paiement", "Payment requests"), isOn: Binding(
                    get: { draft?.notifyPayments ?? true },
                    set: { draft?.notifyPayments = $0 }
                ))
                Toggle(tr("Résultats de tournois", "Tournament results"), isOn: Binding(
                    get: { draft?.notifyTournaments ?? false },
                    set: { draft?.notifyTournaments = $0 }
                ))
            } header: {
                Text(tr("Notifications", "Notifications"))
            } footer: {
                Text(tr(
                    "Notifications push sur iPhone et Android, et rappel par email pour les paiements.",
                    "Push notifications on iPhone and Android, plus email reminders for payments."
                ))
            }

            Section {
                Button(tr("Se déconnecter", "Sign out"), role: .destructive) {
                    dismiss()
                    store.signOut()
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.canvas)
        .keyboardDismissable()
    }

    private func save() {
        guard var draft else { return }
        draft.birthDate = hasBirthDate ? birthDate : nil
        store.updateMember(draft)
        dismiss()
    }
}

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

    var body: some View {
        NavigationStack {
            Group {
                if let draft {
                    form(for: draft)
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Modifier mon profil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer", action: save)
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
                        Label("Changer la photo", systemImage: "camera.fill")
                            .font(.subheadline.weight(.semibold))
                    }
                    if member.photoData != nil {
                        Button("Retirer la photo", role: .destructive) {
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

            Section("Identité") {
                TextField("Prénom", text: Binding(
                    get: { draft?.firstName ?? "" },
                    set: { draft?.firstName = $0 }
                ))
                TextField("Nom", text: Binding(
                    get: { draft?.lastName ?? "" },
                    set: { draft?.lastName = $0 }
                ))
                Toggle("Date de naissance", isOn: $hasBirthDate)
                if hasBirthDate {
                    DatePicker("Née(e) le", selection: $birthDate, displayedComponents: .date)
                }
            }

            Section {
                TextField("Email", text: Binding(
                    get: { draft?.email ?? "" },
                    set: { draft?.email = $0 }
                ))
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

                TextField("Téléphone", text: Binding(
                    get: { draft?.phone ?? "" },
                    set: { draft?.phone = $0 }
                ))
                .keyboardType(.phonePad)
            } header: {
                Text("Contact")
            } footer: {
                Text("Visible par le bureau du club.")
            }

            Section {
                Toggle("Annonces du club", isOn: Binding(
                    get: { draft?.notifyAnnouncements ?? true },
                    set: { draft?.notifyAnnouncements = $0 }
                ))
                Toggle("Événements et convocations", isOn: Binding(
                    get: { draft?.notifyEvents ?? true },
                    set: { draft?.notifyEvents = $0 }
                ))
                Toggle("Appels à paiement", isOn: Binding(
                    get: { draft?.notifyPayments ?? true },
                    set: { draft?.notifyPayments = $0 }
                ))
                Toggle("Résultats de tournois", isOn: Binding(
                    get: { draft?.notifyTournaments ?? false },
                    set: { draft?.notifyTournaments = $0 }
                ))
            } header: {
                Text("Notifications")
            } footer: {
                Text("Notifications push sur iPhone et Android, et rappel par email pour les paiements.")
            }

            Section {
                Button("Se déconnecter", role: .destructive) {
                    dismiss()
                    store.signOut()
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.canvas)
    }

    private func save() {
        guard var draft else { return }
        draft.birthDate = hasBirthDate ? birthDate : nil
        store.updateMember(draft)
        dismiss()
    }
}

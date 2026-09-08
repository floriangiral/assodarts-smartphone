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
            .navigationTitle(tr("edit_my_profile"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("save"), action: save)
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
                        Label(tr("change_photo"), systemImage: "camera.fill")
                            .font(.subheadline.weight(.semibold))
                    }
                    if member.photoData != nil {
                        Button(tr("remove_photo"), role: .destructive) {
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

            Section(tr("identity")) {
                TextField(tr("first_name"), text: Binding(
                    get: { draft?.firstName ?? "" },
                    set: { draft?.firstName = $0 }
                ))
                .keyboardField(.name, submit: .next)
                .focused($focusedField, equals: .firstName)
                .onSubmit { focusedField = .lastName }
                .foregroundStyle(Theme.ink)

                TextField(tr("last_name"), text: Binding(
                    get: { draft?.lastName ?? "" },
                    set: { draft?.lastName = $0 }
                ))
                .keyboardField(.name, submit: .next)
                .focused($focusedField, equals: .lastName)
                .onSubmit { focusedField = .email }
                .foregroundStyle(Theme.ink)

                Toggle(tr("date_of_birth"), isOn: $hasBirthDate)
                if hasBirthDate {
                    DatePicker(tr("born_on"), selection: $birthDate, displayedComponents: .date)
                }
            }

            Section {
                TextField(tr("email"), text: Binding(
                    get: { draft?.email ?? "" },
                    set: { draft?.email = $0 }
                ))
                .keyboardField(.email, submit: .next)
                .focused($focusedField, equals: .email)
                .onSubmit { focusedField = .phone }
                .foregroundStyle(Theme.ink)

                TextField(tr("phone"), text: Binding(
                    get: { draft?.phone ?? "" },
                    set: { draft?.phone = $0 }
                ))
                .keyboardField(.phone, submit: .done)
                .focused($focusedField, equals: .phone)
                .foregroundStyle(Theme.ink)
            } header: {
                Text(tr("contact"))
            } footer: {
                Text(tr("visible_to_the_club_committee"))
            }

            Section {
                Toggle(tr("club_announcements"), isOn: Binding(
                    get: { draft?.notifyAnnouncements ?? true },
                    set: { draft?.notifyAnnouncements = $0 }
                ))
                Toggle(tr("events_and_call_ups"), isOn: Binding(
                    get: { draft?.notifyEvents ?? true },
                    set: { draft?.notifyEvents = $0 }
                ))
                Toggle(tr("payment_requests"), isOn: Binding(
                    get: { draft?.notifyPayments ?? true },
                    set: { draft?.notifyPayments = $0 }
                ))
                Toggle(tr("tournament_results"), isOn: Binding(
                    get: { draft?.notifyTournaments ?? false },
                    set: { draft?.notifyTournaments = $0 }
                ))
            } header: {
                Text(tr("notifications"))
            } footer: {
                Text(tr("push_notifications_on_iphone_and_android_plus_email_remi"))
            }

            Section {
                Button(tr("sign_out"), role: .destructive) {
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

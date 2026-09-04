import SwiftUI

/// Bureau composer for a new club event.
struct NewEventSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""
    @State private var kind: EventKind = .entrainement
    @State private var date: Date = Calendar.current.date(byAdding: .day, value: 7, to: .now) ?? .now
    @State private var location: String = ""
    @State private var details: String = ""
    @FocusState private var isEditing: Bool

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !location.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("Événement", "Event")) {
                    TextField(tr("Titre", "Title"), text: $title)
                        .keyboardField(.freeText, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                    Picker(tr("Type", "Type"), selection: $kind) {
                        ForEach(EventKind.allCases) { kind in
                            Text(kind.label).tag(kind)
                        }
                    }
                    DatePicker(tr("Date et heure", "Date and time"), selection: $date)
                    TextField(tr("Lieu", "Location"), text: $location)
                        .keyboardField(.freeText, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                }

                Section(tr("Détails", "Details")) {
                    TextField(tr("Informations pratiques…", "Practical information…"), text: $details, axis: .vertical)
                        .lineLimit(4...8)
                        .keyboardField(.freeText, submit: .return)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditing) { isEditing = false }
            .navigationTitle(tr("Nouvel événement", "New event"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("Annuler", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("Créer", "Create"), action: save)
                        .disabled(!canSave)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private func save() {
        guard let club = store.currentClub else { return }
        let event = ClubEvent(
            clubId: club.id,
            title: title.trimmingCharacters(in: .whitespaces),
            kind: kind,
            date: date,
            location: location.trimmingCharacters(in: .whitespaces),
            details: details.trimmingCharacters(in: .whitespaces)
        )
        store.addEvent(event)
        NotificationService.notify(title: tr("Nouvel événement", "New event"), body: event.title)
        dismiss()
    }
}

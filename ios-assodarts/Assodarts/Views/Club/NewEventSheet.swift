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

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !location.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Événement") {
                    TextField("Titre", text: $title)
                    Picker("Type", selection: $kind) {
                        ForEach(EventKind.allCases) { kind in
                            Text(kind.label).tag(kind)
                        }
                    }
                    DatePicker("Date et heure", selection: $date)
                    TextField("Lieu", text: $location)
                }

                Section("Détails") {
                    TextField("Informations pratiques…", text: $details, axis: .vertical)
                        .lineLimit(4...8)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .navigationTitle("Nouvel événement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer", action: save)
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
        NotificationService.notify(title: "Nouvel événement", body: event.title)
        dismiss()
    }
}

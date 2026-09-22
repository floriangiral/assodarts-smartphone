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
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case title
        case location
        case details
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !location.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("event")) {
                    TextField(tr("title"), text: $title)
                        .keyboardField(.freeText, submit: .next)
                        .focused($focusedField, equals: .title)
                        .onSubmit { focusedField = .location }
                        .foregroundStyle(Theme.ink)
                    Picker(tr("type"), selection: $kind) {
                        ForEach(EventKind.allCases) { kind in
                            Text(kind.label).tag(kind)
                        }
                    }
                    DatePicker(tr("date_and_time"), selection: $date)
                    TextField(tr("location"), text: $location)
                        .keyboardField(.freeText, submit: .next)
                        .focused($focusedField, equals: .location)
                        .onSubmit { focusedField = .details }
                        .foregroundStyle(Theme.ink)
                }

                Section(tr("details")) {
                    TextField(tr("practical_information"), text: $details, axis: .vertical)
                        .lineLimit(4...8)
                        .keyboardField(.freeText, submit: .return)
                        .focused($focusedField, equals: .details)
                        .onSubmit { focusedField = nil }
                        .foregroundStyle(Theme.ink)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: focusedField != nil) { focusedField = nil }
            .navigationTitle(tr("new_event"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("create"), action: save)
                        .disabled(!canSave)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private func save() {
        focusedField = nil
        guard let club = store.currentClub, let user = store.currentUser else { return }
        let event = ClubEvent(
            clubId: club.id,
            title: title.trimmingCharacters(in: .whitespaces),
            kind: kind,
            date: date,
            location: location.trimmingCharacters(in: .whitespaces),
            details: details.trimmingCharacters(in: .whitespaces),
            authorId: user.id
        )
        store.addEvent(event)
        NotificationService.notify(title: tr("new_event"), body: event.title)
        dismiss()
    }
}

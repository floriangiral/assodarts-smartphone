import SwiftUI

/// Create a tournament to follow and designate its marqueurs.
struct NewTournamentSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var date: Date = .now
    @State private var location: String = ""
    @State private var markerIds: Set<UUID> = []
    @FocusState private var isEditing: Bool

    private var members: [Member] {
        guard let club = store.currentClub else { return [] }
        return store.members(of: club.id)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !location.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("tournament")) {
                    TextField(tr("tournament_name"), text: $name)
                        .keyboardField(.freeText, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                    DatePicker(tr("date"), selection: $date, displayedComponents: .date)
                    TextField(tr("location"), text: $location)
                        .keyboardField(.freeText, submit: .done)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                }

                Section {
                    ForEach(members) { member in
                        Button {
                            if markerIds.contains(member.id) {
                                markerIds.remove(member.id)
                            } else {
                                markerIds.insert(member.id)
                            }
                        } label: {
                            HStack(spacing: 12) {
                                AvatarView(initials: member.initials, photoData: member.photoData, size: 32)
                                Text(member.fullName)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.ink)
                                Spacer()
                                Image(systemName: markerIds.contains(member.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(
                                        markerIds.contains(member.id)
                                            ? Theme.navy
                                            : Theme.inkSecondary.opacity(0.4)
                                    )
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text(tr("scorers"))
                } footer: {
                    Text(tr("appointed_scorers_will_be_able_to_record_the_tournament_"))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditing) { isEditing = false }
            .navigationTitle(tr("new_tournament"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("create"), action: save)
                        .fontWeight(.semibold)
                        .disabled(!canSave)
                }
            }
        }
    }

    private func save() {
        guard let club = store.currentClub else { return }
        let tournament = Tournament(
            clubId: club.id,
            name: name.trimmingCharacters(in: .whitespaces),
            date: date,
            location: location.trimmingCharacters(in: .whitespaces),
            markerIds: Array(markerIds)
        )
        store.addTournament(tournament)
        dismiss()
    }
}

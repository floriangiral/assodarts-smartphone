import SwiftUI

/// Free-form result entry: the marqueur describes the "tableau" and the "tour"
/// in his own words — no imposed bracket vocabulary.
struct NewEntrySheet: View {
    let tournamentId: UUID

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var tableau: String = ""
    @State private var tour: String = ""
    @State private var playerA: String = ""
    @State private var playerB: String = ""
    @State private var scoreA: Int = 0
    @State private var scoreB: Int = 0
    @State private var note: String = ""
    @FocusState private var isEditing: Bool

    private var tournament: Tournament? {
        store.db.tournaments.first { $0.id == tournamentId }
    }

    private var canSave: Bool {
        !tableau.trimmingCharacters(in: .whitespaces).isEmpty
            && !playerA.trimmingCharacters(in: .whitespaces).isEmpty
            && !playerB.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(tr("Ex. Tableau principal", "E.g. Main draw"), text: $tableau)
                        .keyboardField(.freeText, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                    TextField(
                        tr("Ex. Poule A, quart, barrage…", "E.g. Group A, quarter-final, play-off…"),
                        text: $tour
                    )
                    .keyboardField(.freeText, submit: .next)
                    .focused($isEditing)
                    .foregroundStyle(Theme.ink)
                } header: {
                    Text(tr("Où en est-on ?", "Where are we?"))
                } footer: {
                    Text(tr(
                        "Décrivez librement le tableau et le tour : l'application n'impose aucun format.",
                        "Describe the draw and the round in your own words — the app imposes no format."
                    ))
                }

                if let tournament, !tournament.tableaux.isEmpty {
                    Section(tr("Tableaux déjà utilisés", "Draws already used")) {
                        ForEach(tournament.tableaux, id: \.self) { existing in
                            Button(existing) { tableau = existing }
                                .font(.subheadline)
                        }
                    }
                }

                Section(tr("Rencontre", "Match")) {
                    TextField(tr("Joueur ou équipe A", "Player or team A"), text: $playerA)
                        .keyboardField(.name, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                    Stepper(tr("Score A · \(scoreA)", "Score A · \(scoreA)"), value: $scoreA, in: 0...30)
                    TextField(tr("Joueur ou équipe B", "Player or team B"), text: $playerB)
                        .keyboardField(.name, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                    Stepper(tr("Score B · \(scoreB)", "Score B · \(scoreB)"), value: $scoreB, in: 0...30)
                }

                Section(tr("Note (facultatif)", "Note (optional)")) {
                    TextField(tr("Détail du match…", "Match details…"), text: $note, axis: .vertical)
                        .lineLimit(3...6)
                        .keyboardField(.freeText, submit: .return)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditing) { isEditing = false }
            .navigationTitle(tr("Saisir un résultat", "Record a result"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("Annuler", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("Enregistrer", "Save"), action: save)
                        .fontWeight(.semibold)
                        .disabled(!canSave)
                }
            }
        }
    }

    private func save() {
        guard let user = store.currentUser else { return }
        let entry = TournamentEntry(
            tableau: tableau.trimmingCharacters(in: .whitespaces),
            tour: tour.trimmingCharacters(in: .whitespaces).isEmpty
                ? tr("Rencontre", "Match")
                : tour.trimmingCharacters(in: .whitespaces),
            playerA: playerA.trimmingCharacters(in: .whitespaces),
            playerB: playerB.trimmingCharacters(in: .whitespaces),
            scoreA: scoreA,
            scoreB: scoreB,
            note: note.trimmingCharacters(in: .whitespaces),
            recordedById: user.id
        )
        store.addEntry(entry, to: tournamentId)
        dismiss()
    }
}

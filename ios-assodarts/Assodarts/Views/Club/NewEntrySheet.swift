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
                    TextField("Ex. Tableau principal", text: $tableau)
                    TextField("Ex. Poule A, quart, barrage…", text: $tour)
                } header: {
                    Text("Où en est-on ?")
                } footer: {
                    Text("Décrivez librement le tableau et le tour : l'application n'impose aucun format.")
                }

                if let tournament, !tournament.tableaux.isEmpty {
                    Section("Tableaux déjà utilisés") {
                        ForEach(tournament.tableaux, id: \.self) { existing in
                            Button(existing) { tableau = existing }
                                .font(.subheadline)
                        }
                    }
                }

                Section("Rencontre") {
                    TextField("Joueur ou équipe A", text: $playerA)
                    Stepper("Score A · \(scoreA)", value: $scoreA, in: 0...30)
                    TextField("Joueur ou équipe B", text: $playerB)
                    Stepper("Score B · \(scoreB)", value: $scoreB, in: 0...30)
                }

                Section("Note (facultatif)") {
                    TextField("Détail du match…", text: $note, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .navigationTitle("Saisir un résultat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer", action: save)
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
                ? "Rencontre"
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

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
                    TextField(tr("e_g_main_draw"), text: $tableau)
                        .keyboardField(.freeText, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                    TextField(
                        tr("e_g_group_a_quarter_final_play_off"),
                        text: $tour
                    )
                    .keyboardField(.freeText, submit: .next)
                    .focused($isEditing)
                    .foregroundStyle(Theme.ink)
                } header: {
                    Text(tr("where_are_we"))
                } footer: {
                    Text(tr("describe_the_draw_and_the_round_in_your_own_words_the_ap"))
                }

                if let tournament, !tournament.tableaux.isEmpty {
                    Section(tr("draws_already_used")) {
                        ForEach(tournament.tableaux, id: \.self) { existing in
                            Button(existing) { tableau = existing }
                                .font(.subheadline)
                        }
                    }
                }

                Section(tr("match")) {
                    TextField(tr("player_or_team_a"), text: $playerA)
                        .keyboardField(.name, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                    Stepper(tr("score_a \(scoreA)"), value: $scoreA, in: 0...30)
                    TextField(tr("player_or_team_b"), text: $playerB)
                        .keyboardField(.name, submit: .next)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)
                    Stepper(tr("score_b \(scoreB)"), value: $scoreB, in: 0...30)
                }

                Section(tr("note_optional")) {
                    TextField(tr("match_details"), text: $note, axis: .vertical)
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
            .navigationTitle(tr("record_a_result"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("save"), action: save)
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
                ? tr("match")
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

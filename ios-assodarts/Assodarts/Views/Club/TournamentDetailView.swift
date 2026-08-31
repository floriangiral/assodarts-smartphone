import SwiftUI

/// Follow a tournament and read the results entered by its marqueurs.
struct TournamentDetailView: View {
    let tournamentId: UUID

    @Environment(AppStore.self) private var store
    @State private var showsEntrySheet: Bool = false

    private var tournament: Tournament? {
        store.db.tournaments.first { $0.id == tournamentId }
    }

    private var isMarker: Bool {
        guard let tournament, let user = store.currentUser else { return false }
        return tournament.markerIds.contains(user.id) || user.role.canManageClub
    }

    var body: some View {
        ScrollView {
            if let tournament {
                VStack(spacing: 16) {
                    headerCard(tournament)

                    if isMarker {
                        PrimaryButton(title: "Saisir un résultat", symbol: "square.and.pencil") {
                            showsEntrySheet = true
                        }
                    }

                    if tournament.entries.isEmpty {
                        ContentUnavailableView(
                            "Aucun résultat",
                            systemImage: "list.bullet.rectangle",
                            description: Text(isMarker
                                ? "Saisissez le premier résultat du tournoi."
                                : "Les marqueurs n'ont pas encore saisi de résultat.")
                        )
                        .padding(.top, 30)
                    } else {
                        ForEach(tournament.tableaux, id: \.self) { tableau in
                            tableauSection(tableau, tournament: tournament)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }
        }
        .assoCanvas()
        .navigationTitle("Suivi du tournoi")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsEntrySheet) {
            NewEntrySheet(tournamentId: tournamentId)
        }
    }

    private func headerCard(_ tournament: Tournament) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                StatusChip(
                    text: tournament.statusLabel,
                    tint: tournament.isFinished ? Theme.inkSecondary : Theme.orange,
                    background: tournament.isFinished ? Theme.canvas : Theme.orangeTint
                )
                Spacer()
                Text(Fmt.mediumDate(tournament.date))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            Text(tournament.name)
                .font(.title3.bold())
                .foregroundStyle(Theme.ink)

            Label(tournament.location, systemImage: "mappin.and.ellipse")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)

            if !tournament.markerIds.isEmpty {
                Divider().overlay(Theme.border)
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: "Marqueurs désignés")
                    ForEach(tournament.markerIds, id: \.self) { id in
                        HStack(spacing: 10) {
                            AvatarView(
                                initials: store.member(id)?.initials ?? "??",
                                photoData: store.member(id)?.photoData,
                                size: 30
                            )
                            Text(store.memberName(id))
                                .font(.subheadline)
                                .foregroundStyle(Theme.ink)
                            Spacer()
                        }
                    }
                }
            }
        }
        .assoCard(padding: 20)
    }

    private func tableauSection(_ tableau: String, tournament: Tournament) -> some View {
        let entries = tournament.entries.filter { $0.tableau == tableau }

        return VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tableau)

            VStack(spacing: 0) {
                ForEach(entries) { entry in
                    entryRow(entry, tournament: tournament)
                    if entry.id != entries.last?.id {
                        Divider().overlay(Theme.border)
                    }
                }
            }
            .assoCard(padding: 14)
        }
    }

    private func entryRow(_ entry: TournamentEntry, tournament: Tournament) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(entry.tour)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.navy)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.navyTint, in: .capsule)
                Spacer()
                Text(entry.scoreLabel)
                    .font(.subheadline.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
            }

            Text("\(entry.playerA) vs \(entry.playerB)")
                .font(.subheadline)
                .foregroundStyle(Theme.ink)

            if !entry.note.isEmpty {
                Text(entry.note)
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            Text("Saisi par \(store.memberName(entry.recordedById)) · \(Fmt.shortDate(entry.recordedAt))")
                .font(.caption2)
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 10)
        .contextMenu {
            if isMarker {
                Button("Supprimer ce résultat", systemImage: "trash", role: .destructive) {
                    store.deleteEntry(entry.id, from: tournament.id)
                }
            }
        }
    }
}

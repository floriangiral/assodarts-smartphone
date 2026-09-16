import SwiftUI

/// Tournaments followed by the club — information only, results entered freely
/// by the designated marqueurs.
struct TournamentsView: View {
    @Environment(AppStore.self) private var store
    @State private var showsComposer: Bool = false

    private var tournaments: [Tournament] {
        guard let club = store.currentClub else { return [] }
        return store.tournaments(of: club.id)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ForEach(tournaments) { tournament in
                    NavigationLink(value: ClubRoute.tournament(tournament.id)) {
                        TournamentCard(tournament: tournament)
                    }
                    .buttonStyle(.plain)
                }

                if tournaments.isEmpty {
                    EmptyStateView(
                        tr("no_tournaments"),
                        systemImage: "trophy",
                        description: Text(tr("the_committee_can_create_a_tournament_and_appoint_its_sc"))
                    )
                    .padding(.top, 60)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .refreshable { await store.refresh() }
        .navigationTitle(tr("tournaments"))
        .toolbar {
            if store.canManageClub {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsComposer = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel(tr("new_tournament"))
                }
            }
        }
        .sheet(isPresented: $showsComposer) {
            NewTournamentSheet()
        }
        .clubDestinations()
    }
}

/// Summary card of a tournament.
struct TournamentCard: View {
    let tournament: Tournament

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                StatusChip(
                    text: tournament.statusLabel,
                    tint: tournament.isFinished ? Theme.inkSecondary : Theme.orange,
                    background: tournament.isFinished ? Theme.canvas : Theme.orangeTint
                )
                Spacer()
                Text(Fmt.shortDate(tournament.date))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            Text(tournament.name)
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.leading)

            Label(tournament.location, systemImage: "mappin.and.ellipse")
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)

            HStack(spacing: 6) {
                Image(systemName: "list.bullet.rectangle")
                    .font(.caption2)
                Text(Fmt.count(tournament.entries.count, key: .results))
                    .font(.caption.weight(.medium))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.6))
            }
            .foregroundStyle(Theme.navy)
        }
        .assoCard()
    }
}

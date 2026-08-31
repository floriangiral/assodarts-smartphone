import SwiftUI

/// Club calendar with attendance answers.
struct EventsView: View {
    @Environment(AppStore.self) private var store
    @State private var showsPast: Bool = false
    @State private var showsComposer: Bool = false

    private var events: [ClubEvent] {
        guard let club = store.currentClub else { return [] }
        let all = store.events(of: club.id)
        return showsPast ? all.filter { $0.date < .now }.reversed() : all.filter { $0.date >= .now }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker(tr("Période", "Period"), selection: $showsPast) {
                    Text(tr("À venir", "Upcoming")).tag(false)
                    Text(tr("Passés", "Past")).tag(true)
                }
                .pickerStyle(.segmented)
                .padding(.bottom, 2)

                ForEach(events) { event in
                    NavigationLink(value: ClubRoute.event(event.id)) {
                        EventCard(event: event)
                    }
                    .buttonStyle(.plain)
                }

                if events.isEmpty {
                    ContentUnavailableView(
                        showsPast
                            ? tr("Aucun événement passé", "No past events")
                            : tr("Aucun événement à venir", "No upcoming events"),
                        systemImage: "calendar",
                        description: Text(tr(
                            "Le bureau publiera ici les entraînements et compétitions.",
                            "The committee will post training sessions and competitions here."
                        ))
                    )
                    .padding(.top, 60)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .navigationTitle(tr("Événements", "Events"))
        .toolbar {
            if store.canManageClub {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsComposer = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel(tr("Nouvel événement", "New event"))
                }
            }
        }
        .sheet(isPresented: $showsComposer) {
            NewEventSheet()
        }
        .clubDestinations()
    }
}

/// Compact event card in the calendar list.
struct EventCard: View {
    let event: ClubEvent

    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Label(event.kind.label, systemImage: event.kind.symbol)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(event.kind.tint)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(event.kind.tint.opacity(0.12), in: .capsule)
                Spacer()
                if let user = store.currentUser, let response = event.response(for: user.id) {
                    StatusChip(
                        text: response ? tr("Présent", "Going") : tr("Absent", "Not going"),
                        tint: response ? Theme.green : Theme.inkSecondary,
                        background: response ? Theme.greenTint : Theme.canvas
                    )
                }
            }

            Text(event.title)
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.leading)

            VStack(alignment: .leading, spacing: 4) {
                Label(Fmt.dayAndTime(event.date), systemImage: "clock")
                Label(event.location, systemImage: "mappin.and.ellipse")
            }
            .font(.caption)
            .foregroundStyle(Theme.inkSecondary)

            HStack(spacing: 6) {
                Image(systemName: "person.2.fill")
                    .font(.caption2)
                Text(Fmt.count(event.attendeeIds.count, "présent", "présents", "attending", "attending"))
                    .font(.caption.weight(.medium))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.6))
            }
            .foregroundStyle(Theme.green)
        }
        .assoCard()
    }
}

/// Event detail with the member's attendance answer and the attendee list.
struct EventDetailView: View {
    let eventId: UUID

    @Environment(AppStore.self) private var store

    private var event: ClubEvent? { store.db.events.first { $0.id == eventId } }

    var body: some View {
        ScrollView {
            if let event, let user = store.currentUser {
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 14) {
                        Label(event.kind.label, systemImage: event.kind.symbol)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(event.kind.tint)

                        Text(event.title)
                            .font(.title2.bold())
                            .foregroundStyle(Theme.ink)

                        VStack(alignment: .leading, spacing: 8) {
                            Label(Fmt.dayAndTime(event.date), systemImage: "clock")
                            Label(event.location, systemImage: "mappin.and.ellipse")
                        }
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)

                        if !event.details.isEmpty {
                            Divider().overlay(Theme.border)
                            Text(event.details)
                                .font(.body)
                                .foregroundStyle(Theme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .assoCard(padding: 20)

                    if event.date >= .now {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionLabel(text: tr("Votre réponse", "Your answer"))
                            HStack(spacing: 12) {
                                answerButton(
                                    tr("Présent", "Going"),
                                    symbol: "checkmark.circle.fill",
                                    tint: Theme.green,
                                    isSelected: event.response(for: user.id) == true
                                ) {
                                    store.setAttendance(
                                        event.response(for: user.id) == true ? nil : true,
                                        eventId: event.id,
                                        memberId: user.id
                                    )
                                }
                                answerButton(
                                    tr("Absent", "Not going"),
                                    symbol: "xmark.circle.fill",
                                    tint: Theme.red,
                                    isSelected: event.response(for: user.id) == false
                                ) {
                                    store.setAttendance(
                                        event.response(for: user.id) == false ? nil : false,
                                        eventId: event.id,
                                        memberId: user.id
                                    )
                                }
                            }
                        }
                        .assoCard()
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        SectionLabel(text: tr(
                            "Participants · \(event.attendeeIds.count)",
                            "Attendees · \(event.attendeeIds.count)"
                        ))
                        if event.attendeeIds.isEmpty {
                            Text(tr("Aucune réponse pour l'instant.", "No answers yet."))
                                .font(.footnote)
                                .foregroundStyle(Theme.inkSecondary)
                        } else {
                            ForEach(event.attendeeIds, id: \.self) { id in
                                HStack(spacing: 10) {
                                    AvatarView(
                                        initials: store.member(id)?.initials ?? "??",
                                        photoData: store.member(id)?.photoData,
                                        size: 32
                                    )
                                    Text(store.memberName(id))
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.ink)
                                    Spacer()
                                }
                                .padding(.vertical, 3)
                            }
                        }
                    }
                    .assoCard()
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }
        }
        .assoCanvas()
        .navigationTitle(tr("Événement", "Event"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func answerButton(
        _ title: String,
        symbol: String,
        tint: Color,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                Text(title)
                    .font(.subheadline.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .foregroundStyle(isSelected ? .white : tint)
            .background(isSelected ? tint : tint.opacity(0.1))
            .clipShape(.rect(cornerRadius: 12))
        }
        .buttonStyle(PressableButtonStyle())
    }
}

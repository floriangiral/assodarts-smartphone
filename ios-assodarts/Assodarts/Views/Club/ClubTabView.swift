import SwiftUI

/// Every push destination of the club space, so any screen can navigate
/// without prop drilling.
enum ClubRoute: Hashable {
    case myPayments
    case paymentCalls
    case paymentCall(UUID)
    case paymentValidation
    case bankSettings
    case messages
    case conversation(UUID)
    case myProfile
    case memberProfile(UUID)
    case announcement(UUID)
    case event(UUID)
    case tournament(UUID)
    case subscription
}

/// Resolves a `ClubRoute` into its destination screen.
struct ClubRouteView: View {
    let route: ClubRoute

    var body: some View {
        switch route {
        case .myPayments:
            MyPaymentsView()
        case .paymentCalls:
            PaymentCallsView()
        case .paymentCall(let id):
            PaymentTrackingView(callId: id)
        case .paymentValidation:
            PaymentValidationView()
        case .bankSettings:
            BankSettingsView()
        case .messages:
            MessagesListView()
        case .conversation(let id):
            ConversationView(conversationId: id)
        case .myProfile:
            MyProfileView()
        case .memberProfile(let id):
            MemberProfileView(memberId: id)
        case .announcement(let id):
            AnnouncementDetailView(announcementId: id)
        case .event(let id):
            EventDetailView(eventId: id)
        case .tournament(let id):
            TournamentDetailView(tournamentId: id)
        case .subscription:
            SubscriptionView()
        }
    }
}

extension View {
    /// Attaches the club destinations and hides the tab bar on pushed screens.
    func clubDestinations() -> some View {
        navigationDestination(for: ClubRoute.self) { route in
            ClubRouteView(route: route)
                .toolbar(.hidden, for: .tabBar)
        }
    }
}

/// The club space: five top-level destinations sharing the same tab bar.
struct ClubTabView: View {
    @State private var selection: Int = 0

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack {
                DashboardView()
            }
            .tabItem { Label(tr("Accueil", "Home"), systemImage: "house.fill") }
            .tag(0)

            NavigationStack {
                AnnouncementsView()
            }
            .tabItem { Label(tr("Annonces", "News"), systemImage: "megaphone.fill") }
            .tag(1)

            NavigationStack {
                EventsView()
            }
            .tabItem { Label(tr("Événements", "Events"), systemImage: "calendar") }
            .tag(2)

            NavigationStack {
                MembersView()
            }
            .tabItem { Label(tr("Membres", "Members"), systemImage: "person.3.fill") }
            .tag(3)

            NavigationStack {
                TournamentsView()
            }
            .tabItem { Label(tr("Tournois", "Tournaments"), systemImage: "trophy.fill") }
            .tag(4)
        }
        .tint(Theme.navy)
    }
}

#Preview {
    ClubTabView()
        .environment(AppStore())
        .environment(Localization.shared)
}

import SwiftUI

/// The developer space: a quiet operations console, separate from club life.
struct DeveloperTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                DevOverviewView()
            }
            .tabItem { Label("Vue d'ensemble", systemImage: "chart.bar.fill") }

            NavigationStack {
                DevFinancesView()
            }
            .tabItem { Label("Finances", systemImage: "eurosign.circle.fill") }

            NavigationStack {
                DevCouponsView()
            }
            .tabItem { Label("Coupons", systemImage: "ticket.fill") }

            NavigationStack {
                DevBroadcastView()
            }
            .tabItem { Label("Annonces", systemImage: "megaphone.fill") }
        }
        .tint(Theme.navy)
    }
}

/// Compact navy band giving the developer space its own identity.
struct DevHeaderBand: View {
    let title: String
    var showsAvatar: Bool = true

    @Environment(AppStore.self) private var store
    @State private var showsSignOut: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Console développeur")
                    .font(.caption.weight(.bold))
                    .tracking(0.8)
                    .foregroundStyle(Theme.orange)
                Text(title)
                    .font(.title3.bold())
                    .foregroundStyle(.white)
            }

            Spacer()

            if showsAvatar, let user = store.currentUser {
                Menu {
                    Button("Réinitialiser les données de démo", systemImage: "arrow.counterclockwise") {
                        store.resetDemoData()
                    }
                    Button("Se déconnecter", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                        showsSignOut = true
                    }
                } label: {
                    AvatarView(initials: user.initials, photoData: user.photoData, size: 42)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [Theme.navy, Theme.navyDeep],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(.rect(cornerRadius: 20))
        .alert("Se déconnecter ?", isPresented: $showsSignOut) {
            Button("Annuler", role: .cancel) {}
            Button("Se déconnecter", role: .destructive) { store.signOut() }
        }
    }
}

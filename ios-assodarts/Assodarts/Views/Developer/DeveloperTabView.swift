import SwiftUI

/// The developer space: a quiet operations console, separate from club life.
struct DeveloperTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                DevOverviewView()
            }
            .tabItem { Label(tr("Vue d'ensemble", "Overview"), systemImage: "chart.bar.fill") }

            NavigationStack {
                DevFinancesView()
            }
            .tabItem { Label(tr("Finances", "Finances"), systemImage: "eurosign.circle.fill") }

            NavigationStack {
                DevCouponsView()
            }
            .tabItem { Label(tr("Coupons", "Coupons"), systemImage: "ticket.fill") }

            NavigationStack {
                DevBroadcastView()
            }
            .tabItem { Label(tr("Annonces", "Broadcasts"), systemImage: "megaphone.fill") }
        }
        .tint(Theme.navy)
    }
}

/// Compact navy band giving the developer space its own identity.
struct DevHeaderBand: View {
    let title: String
    var showsAvatar: Bool = true

    @Environment(AppStore.self) private var store
    @Environment(Localization.self) private var localization
    @State private var showsSignOut: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(tr("Console développeur", "Developer console"))
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
                    Picker(tr("Langue", "Language"), selection: Binding(
                        get: { localization.preference },
                        set: { localization.preference = $0 }
                    )) {
                        ForEach(AppLanguage.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    Button(
                        tr("Réinitialiser les données de démo", "Reset demo data"),
                        systemImage: "arrow.counterclockwise"
                    ) {
                        store.resetDemoData()
                    }
                    Button(
                        tr("Se déconnecter", "Sign out"),
                        systemImage: "rectangle.portrait.and.arrow.right",
                        role: .destructive
                    ) {
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
        .alert(tr("Se déconnecter ?", "Sign out?"), isPresented: $showsSignOut) {
            Button(tr("Annuler", "Cancel"), role: .cancel) {}
            Button(tr("Se déconnecter", "Sign out"), role: .destructive) { store.signOut() }
        }
    }
}

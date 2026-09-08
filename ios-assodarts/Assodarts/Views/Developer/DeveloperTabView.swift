import SwiftUI

/// The developer space: a quiet operations console, separate from club life.
struct DeveloperTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                DevOverviewView()
            }
            .tabItem { Label(tr("overview"), systemImage: "chart.bar.fill") }

            NavigationStack {
                DevFinancesView()
            }
            .tabItem { Label(tr("finances"), systemImage: "eurosign.circle.fill") }

            NavigationStack {
                DevCouponsView()
            }
            .tabItem { Label(tr("coupons"), systemImage: "ticket.fill") }

            NavigationStack {
                DevBroadcastView()
            }
            .tabItem { Label(tr("broadcasts"), systemImage: "megaphone.fill") }
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
                Text(tr("developer_console"))
                    .font(.caption.weight(.bold))
                    .tracking(0.8)
                    .foregroundStyle(Theme.orange)
                Text(title)
                    .font(.title3.bold())
                    .foregroundStyle(.white)
            }

            Spacer()

            if showsAvatar {
                Menu {
                    Picker(tr("language"), selection: Binding(
                        get: { localization.preference },
                        set: { localization.preference = $0 }
                    )) {
                        ForEach(AppLanguage.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    Button(
                        tr("reset_demo_data"),
                        systemImage: "arrow.counterclockwise"
                    ) {
                        store.resetDemoData()
                    }
                    Button(
                        tr("sign_out"),
                        systemImage: "rectangle.portrait.and.arrow.right",
                        role: .destructive
                    ) {
                        showsSignOut = true
                    }
                } label: {
                    AvatarView(
                        initials: store.currentUser?.initials ?? "PA",
                        photoData: store.currentUser?.photoData,
                        size: 42
                    )
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
        .clipShape(.rect(cornerRadius: Theme.largeRadius))
        .alert(tr("sign_out_developertabview"), isPresented: $showsSignOut) {
            Button(tr("cancel"), role: .cancel) {}
            Button(tr("sign_out"), role: .destructive) { store.signOut() }
        }
    }
}

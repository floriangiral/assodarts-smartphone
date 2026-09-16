import SwiftUI

/// Routes to the right space: login, the club app, or the developer console.
struct ContentView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if store.isRestoringSession {
                SplashView()
                    .transition(.opacity)
            } else if store.needsPlatformAdminBootstrap {
                PlatformAdminSetupView()
                    .transition(.opacity)
            } else if store.isDeveloper {
                DeveloperTabView()
                    .transition(.opacity)
            } else if store.currentUser != nil {
                ClubTabView()
                    .transition(.opacity)
            } else if store.needsOnboardingChoice {
                OnboardingChoiceView()
                    .transition(.opacity)
            } else {
                LoginView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: store.currentUserId)
        .animation(.easeInOut(duration: 0.25), value: store.isRestoringSession)
        .animation(.easeInOut(duration: 0.25), value: store.needsPlatformAdminBootstrap)
        .task {
            await store.restoreSession()
            await NotificationService.requestAuthorization()
        }
        // Only a real return from the background: at launch there is no prior
        // `.background` phase, so this never doubles up with restoreSession(),
        // and a passing `.inactive` (control centre, system alert) is ignored.
        .onChange(of: scenePhase) { previous, phase in
            guard phase == .active, previous == .background, store.currentUser != nil else { return }
            Task { await store.refresh() }
        }
    }
}

/// Shown for the fraction of a second it takes to check the stored session.
private struct SplashView: View {
    @State private var isPulsing: Bool = false

    var body: some View {
        VStack(spacing: 18) {
            BrandMark(size: 84)
                .scaleEffect(isPulsing ? 1.04 : 0.96)
                .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: isPulsing)
            ProgressView()
                .tint(Theme.navy)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .assoCanvas()
        .onAppear { isPulsing = true }
    }
}

#Preview {
    ContentView()
        .environment(AppStore())
        .environment(Localization.shared)
}

import SwiftUI

/// Routes to the right space: login, the club app, or the developer console.
struct ContentView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        Group {
            if store.isRestoringSession {
                SplashView()
                    .transition(.opacity)
            } else if let user = store.currentUser {
                if user.role == .developpeur {
                    DeveloperTabView()
                        .transition(.opacity)
                } else {
                    ClubTabView()
                        .transition(.opacity)
                }
            } else {
                LoginView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: store.currentUserId)
        .animation(.easeInOut(duration: 0.25), value: store.isRestoringSession)
        .task {
            await store.restoreSession()
            await NotificationService.requestAuthorization()
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

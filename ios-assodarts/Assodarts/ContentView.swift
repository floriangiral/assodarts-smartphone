import SwiftUI

/// Routes to the right space: login, the club app, or the developer console.
struct ContentView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        Group {
            if let user = store.currentUser {
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
        .task {
            await NotificationService.requestAuthorization()
        }
    }
}

#Preview {
    ContentView()
        .environment(AppStore())
}

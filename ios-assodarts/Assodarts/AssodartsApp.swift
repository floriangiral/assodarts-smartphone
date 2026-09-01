//
//  AssodartsApp.swift
//  Assodarts
//

import SwiftUI
import UIKit

/// Receives the APNs device token and hands it to the store, which stores it
/// against the signed-in member so the club can push to this phone.
final class AppDelegate: NSObject, UIApplicationDelegate {
    static let didRegisterToken = Notification.Name("assodarts.push.token")

    nonisolated func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in
            NotificationCenter.default.post(
                name: Self.didRegisterToken,
                object: nil,
                userInfo: ["token": token]
            )
        }
    }

    nonisolated func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Push registration failed: \(error.localizedDescription)")
    }
}

@main
struct AssodartsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var store = AppStore()
    @State private var localization = Localization.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
                .environment(localization)
                .environment(\.locale, localization.locale)
                .tint(Theme.navy)
                .id(localization.lang)
                .onReceive(NotificationCenter.default.publisher(for: AppDelegate.didRegisterToken)) { note in
                    guard let token = note.userInfo?["token"] as? String else { return }
                    store.registerPushToken(token)
                }
        }
    }
}

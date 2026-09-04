//
//  AssodartsApp.swift
//  Assodarts
//

import FirebaseCore
import FirebaseMessaging
import SwiftUI
import UIKit

/// Bridges the APNs device token to FCM, and forwards the FCM registration
/// token to the store so the club can push to this phone.
final class AppDelegate: NSObject, UIApplicationDelegate, MessagingDelegate {
    static let didRegisterToken = Notification.Name("assodarts.push.token")

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        Backend.configure()
        Messaging.messaging().delegate = self
        return true
    }

    nonisolated func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Messaging.messaging().apnsToken = deviceToken
    }

    nonisolated func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Push registration failed: \(error.localizedDescription)")
    }

    nonisolated func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else { return }
        Task { @MainActor in
            NotificationCenter.default.post(
                name: Self.didRegisterToken,
                object: nil,
                userInfo: ["token": fcmToken]
            )
        }
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
                .tint(Theme.navyText)
                .id(localization.lang)
                .onReceive(NotificationCenter.default.publisher(for: AppDelegate.didRegisterToken)) { note in
                    guard let token = note.userInfo?["token"] as? String else { return }
                    store.registerPushToken(token)
                }
        }
    }
}


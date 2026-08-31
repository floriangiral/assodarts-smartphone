import Foundation
import UserNotifications

/// Thin wrapper around local notifications. On device, the same payloads are
/// delivered as push notifications (APNs on iOS, FCM on Android).
enum NotificationService {
    static func requestAuthorization() async {
        do {
            _ = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            print("Notifications: authorization denied or unavailable")
        }
    }

    /// Schedules an immediate local notification mirroring what the server push
    /// will deliver in production.
    static func notify(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)
        )
        UNUserNotificationCenter.current().add(request) { error in
            if error != nil {
                print("Notifications: delivery failed")
            }
        }
    }
}

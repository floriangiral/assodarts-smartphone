import Foundation
import UIKit
import UserNotifications

/// Local notifications: immediate confirmations, and the due-date reminders that
/// chase members before a payment falls late.
///
/// These work with no server at all. Server-sent push uses the same content
/// and is wired through Firebase Cloud Messaging once `AppDelegate` bridges the
/// APNs device token to FCM.
enum NotificationService {
    /// One outstanding payment line worth reminding a member about.
    nonisolated struct DueReminder: Sendable, Hashable {
        let id: UUID
        let label: String
        let amountCents: Int
        let dueDate: Date
    }

    private static let reminderPrefix = "due-reminder-"

    static func requestAuthorization() async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                await UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            print("Notifications: authorization denied or unavailable")
        }
    }

    /// Schedules an immediate local notification.
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

    /// Re-arms every payment reminder: one a week before the due date, one the
    /// day before, and one the morning after if it is still unpaid.
    ///
    /// Identifiers are derived from the payment line, so re-scheduling after a
    /// sync replaces the previous reminders instead of piling them up.
    static func scheduleDueReminders(_ reminders: [DueReminder]) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let stale = pending
                .map(\.identifier)
                .filter { $0.hasPrefix(reminderPrefix) }
            center.removePendingNotificationRequests(withIdentifiers: stale)

            for reminder in reminders {
                schedule(reminder, in: center)
            }
        }
    }

    static func clearScheduledReminders() {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let identifiers = pending
                .map(\.identifier)
                .filter { $0.hasPrefix(reminderPrefix) }
            center.removePendingNotificationRequests(withIdentifiers: identifiers)
        }
    }

    private static func schedule(_ reminder: DueReminder, in center: UNUserNotificationCenter) {
        let amount = Fmt.money(reminder.amountCents)

        let steps: [(suffix: String, offsetDays: Int, title: String, body: String)] = [
            (
                "7d",
                -7,
                tr("Paiement à venir", "Payment coming up"),
                tr(
                    "\(reminder.label) · \(amount) à régler sous 7 jours.",
                    "\(reminder.label) · \(amount) due within 7 days."
                )
            ),
            (
                "1d",
                -1,
                tr("Paiement demain", "Payment due tomorrow"),
                tr(
                    "\(reminder.label) · \(amount) à régler avant demain soir.",
                    "\(reminder.label) · \(amount) due by tomorrow evening."
                )
            ),
            (
                "late",
                1,
                tr("Paiement en retard", "Payment overdue"),
                tr(
                    "\(reminder.label) · \(amount) n'a pas encore été réglé.",
                    "\(reminder.label) · \(amount) has still not been settled."
                )
            )
        ]

        let calendar = Calendar.current

        for step in steps {
            guard
                let day = calendar.date(byAdding: .day, value: step.offsetDays, to: reminder.dueDate),
                let fireDate = calendar.date(bySettingHour: 10, minute: 0, second: 0, of: day),
                fireDate > .now
            else { continue }

            let content = UNMutableNotificationContent()
            content.title = step.title
            content.body = step.body
            content.sound = .default
            content.threadIdentifier = "payments"

            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
            let request = UNNotificationRequest(
                identifier: "\(reminderPrefix)\(reminder.id.uuidString)-\(step.suffix)",
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            )
            center.add(request) { error in
                if error != nil {
                    print("Notifications: could not schedule reminder")
                }
            }
        }
    }
}

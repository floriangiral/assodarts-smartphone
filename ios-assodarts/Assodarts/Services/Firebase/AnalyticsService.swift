import FirebaseAnalytics
import Foundation

enum AnalyticsService {
    static let privacyPolicyURL = configuredPrivacyPolicyURL()

    private static let collectionEnabledKey = "assodarts.analytics.collectionEnabled.v1"

    private static func configuredPrivacyPolicyURL() -> URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "ASSODARTSPrivacyPolicyURL") as? String
        return raw.flatMap(URL.init(string:)) ?? URL(fileURLWithPath: NSHomeDirectory())
    }

    static var isCollectionEnabled: Bool {
        UserDefaults.standard.object(forKey: collectionEnabledKey) as? Bool ?? true
    }

    static func applyCollectionPreference() {
        Analytics.setAnalyticsCollectionEnabled(isCollectionEnabled)
    }

    static func setCollectionEnabled(_ isEnabled: Bool) {
        UserDefaults.standard.set(isEnabled, forKey: collectionEnabledKey)
        Analytics.setAnalyticsCollectionEnabled(isEnabled)
    }

    static func clearUserProperties() {
        Analytics.setUserProperty(nil as String?, forName: "club_id")
        Analytics.setUserProperty(nil as String?, forName: "member_role")
    }

    static func updateUserProperties(clubId: UUID?, role: Role?) {
        Analytics.setUserProperty(clubId?.uuidString, forName: "club_id")
        Analytics.setUserProperty(role.map { roleProperty($0) }, forName: "member_role")
    }

    static func logLogin(memberRole: String) {
        Analytics.logEvent(AnalyticsEventLogin, parameters: [
            AnalyticsParameterMethod: "email_password",
            "member_role": memberRole,
        ])
    }

    static func logSignUp(method: String) {
        Analytics.logEvent(AnalyticsEventSignUp, parameters: [
            AnalyticsParameterMethod: method,
        ])
    }

    static func logClubCreated(clubId: String, source: String) {
        Analytics.logEvent("club_created", parameters: [
            "club_id": clubId,
            "source": source,
        ])
    }

    static func logClubJoined(clubId: String) {
        Analytics.logEvent("club_joined", parameters: [
            "club_id": clubId,
        ])
    }

    static func logTournamentCreated(
        clubId: UUID,
        tournamentId: UUID,
        markerCount: Int
    ) {
        Analytics.logEvent("tournament_created", parameters: [
            "club_id": clubId.uuidString,
            "tournament_id": tournamentId.uuidString,
            "marker_count": markerCount,
        ])
    }

    static func logClubSubscriptionCheckoutStarted(
        club: Club,
        tier: PricingTier,
        priceCents: Int
    ) {
        Analytics.logEvent("club_subscription_checkout_started", parameters: [
            "club_id": club.id.uuidString,
            "club_status": club.status.rawValue,
            "tier_id": tier.id,
            "price_cents": priceCents,
        ])
    }

    static func roleProperty(_ role: Role) -> String {
        role.canManageClub || role == .developpeur ? "admin" : "member"
    }
}

import SafariServices
import SwiftUI

/// Presents Stripe's hosted pages (Checkout, Connect onboarding) inside the app.
///
/// Using the system browser keeps card data entirely out of Assodarts — nothing
/// sensitive ever passes through our code.
struct SafariSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let configuration = SFSafariViewController.Configuration()
        configuration.barCollapsingEnabled = true

        let controller = SFSafariViewController(url: url, configuration: configuration)
        controller.preferredBarTintColor = UIColor(Theme.navy)
        controller.preferredControlTintColor = .white
        controller.dismissButtonStyle = .close
        return controller
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

/// A URL that can drive a `.sheet(item:)` presentation.
struct IdentifiableURL: Identifiable, Hashable {
    let url: URL

    var id: String { url.absoluteString }
}

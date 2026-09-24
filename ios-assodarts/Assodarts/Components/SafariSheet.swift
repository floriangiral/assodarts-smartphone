import SafariServices
import SwiftUI

/// Presents Stripe's hosted pages (Checkout, Connect onboarding) inside the app.
///
/// Using the system browser keeps card data entirely out of Assodarts — nothing
/// sensitive ever passes through our code.
struct SafariSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context _: Context) -> SFSafariViewController {
        let configuration = SFSafariViewController.Configuration()
        configuration.barCollapsingEnabled = true

        let controller = SFSafariViewController(url: url, configuration: configuration)
        controller.dismissButtonStyle = .close
        return controller
    }

    func updateUIViewController(_: SFSafariViewController, context _: Context) {
        // Stripe's hosted page is static once presented; there is nothing to update.
    }
}

/// A URL that can drive a `.sheet(item:)` presentation.
struct IdentifiableURL: Identifiable, Hashable {
    let url: URL

    var id: String { url.absoluteString }
}

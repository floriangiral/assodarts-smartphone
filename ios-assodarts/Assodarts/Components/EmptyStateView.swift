import SwiftUI

/// Keeps empty collections aligned across the app canvas.
struct EmptyStateView: View {
    private let title: String?
    private let systemImage: String?
    private let description: Text?
    private let searchText: String?

    init(_ title: String, systemImage: String, description: Text? = nil) {
        self.title = title
        self.systemImage = systemImage
        self.description = description
        self.searchText = nil
    }

    private init(searchText: String) {
        self.title = nil
        self.systemImage = nil
        self.description = nil
        self.searchText = searchText
    }

    static func search(text: String) -> EmptyStateView {
        EmptyStateView(searchText: text)
    }

    var body: some View {
        Group {
            if let searchText {
                VStack(spacing: 12) {
                    Image(systemName: "magnifyingglass")
                        .font(.largeTitle)
                        .foregroundStyle(Theme.inkSecondary)
                    Text(searchText)
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                }
            } else if let title, let systemImage {
                VStack(spacing: 12) {
                    Image(systemName: systemImage)
                        .font(.largeTitle)
                        .foregroundStyle(Theme.inkSecondary)
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                    if let description {
                        description
                            .font(.subheadline)
                            .foregroundStyle(Theme.inkSecondary)
                            .multilineTextAlignment(.center)
                    }
                }
            }
        }
        .padding(.top, 56)
    }
}

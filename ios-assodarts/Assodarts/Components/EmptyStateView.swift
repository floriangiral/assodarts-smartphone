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
                ContentUnavailableView.search(text: searchText)
            } else if let title, let systemImage {
                if let description {
                    ContentUnavailableView(
                        title,
                        systemImage: systemImage,
                        description: { description }
                    )
                } else {
                    ContentUnavailableView(title, systemImage: systemImage)
                }
            }
        }
        .padding(.top, 56)
    }
}

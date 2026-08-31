import SwiftUI

/// Circular avatar showing a member photo when available, initials otherwise.
struct AvatarView: View {
    let initials: String
    var photoData: Data?
    var size: CGFloat = 44
    var filled: Bool = false

    var body: some View {
        Circle()
            .fill(filled ? Theme.navy : Theme.navyTint)
            .frame(width: size, height: size)
            .overlay {
                if let photoData, let image = UIImage(data: photoData) {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .clipShape(.circle)
                        .allowsHitTesting(false)
                } else {
                    Text(initials)
                        .font(.system(size: size * 0.36, weight: .semibold))
                        .foregroundStyle(filled ? .white : Theme.navy)
                }
            }
            .clipShape(.circle)
            .accessibilityHidden(true)
    }
}

#Preview {
    HStack(spacing: 16) {
        AvatarView(initials: "SL")
        AvatarView(initials: "FB", size: 56, filled: true)
    }
    .padding()
    .assoCanvas()
}

import SwiftUI

struct CreateClubView: View {
    @Environment(AppStore.self) private var store
    let onCancel: () -> Void

    @State private var name = ""
    @State private var errorMessage: String?
    @State private var isSubmitting = false
    @FocusState private var isFocused: Bool

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var isValid: Bool { (2...80).contains(trimmedName.count) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(tr("create_my_club")).font(.title3.bold()).foregroundStyle(Theme.ink)
            TextField(tr("club_name"), text: $name)
                .keyboardField(.default, submit: .done)
                .focused($isFocused)
                .foregroundStyle(Theme.ink)
                .padding(14)
                .background(Theme.surface, in: .rect(cornerRadius: Theme.controlRadius))
            if let errorMessage {
                Text(errorMessage).font(.subheadline).foregroundStyle(.red)
            }
            PrimaryButton(title: tr("create_club"), symbol: "plus", isEnabled: isValid && !isSubmitting, action: submit)
            Button(tr("back"), action: onCancel)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity)
        }
    }

    private func submit() {
        guard isValid, let userId = store.currentUserId else { return }
        isSubmitting = true
        errorMessage = nil
        Task {
            let result = await store.createClubFromOnboarding(name: trimmedName, userId: userId)
            if let result { errorMessage = result }
            isSubmitting = false
        }
    }
}
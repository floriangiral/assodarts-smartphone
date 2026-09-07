import SwiftUI

struct OnboardingChoiceView: View {
    @Environment(AppStore.self) private var store
    @State private var showsCreateClub = false
    @State private var isRefreshing = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                BrandMark(size: 72)
                Text(tr("how_would_you_like_to_join_assodarts"))
                    .font(.title2.bold())
                    .foregroundStyle(Theme.ink)
                Text(tr("choose_an_option_you_can_change_your_choice_later"))
                    .foregroundStyle(Theme.inkSecondary)
                VStack(spacing: 12) {
                    onboardingButton(
                        title: tr("i_was_invited_by_my_club"),
                        detail: tr("wait_for_your_club_board_to_register_your_invitation_with_this_email_address"),
                        symbol: "envelope.badge",
                        isSelected: !showsCreateClub
                    ) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showsCreateClub = false
                        }
                    }
                    onboardingButton(
                        title: tr("create_my_club"),
                        detail: tr("create_your_club_and_become_an_administrator_automatical"),
                        symbol: "plus.circle",
                        isSelected: showsCreateClub
                    ) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showsCreateClub = true
                        }
                    }
                }
                if !showsCreateClub {
                    PrimaryButton(title: tr("refresh"), symbol: "arrow.clockwise", isEnabled: !isRefreshing, action: refresh)
                } else {
                    CreateClubView(onCancel: { showsCreateClub = false })
                }
                Spacer()
            }
            .padding(24)
            .assoCanvas()
            .navigationTitle(tr("welcome"))
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func onboardingButton(
        title: String,
        detail: String,
        symbol: String,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: symbol).font(.title3).foregroundStyle(Theme.navy)
                VStack(alignment: .leading, spacing: 5) {
                    Text(title).font(.headline).foregroundStyle(Theme.ink)
                    Text(detail).font(.subheadline).foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
            }
            .padding(16)
            .background(
                isSelected ? Theme.navyTint : Theme.surface,
                in: .rect(cornerRadius: Theme.buttonRadius)
            )
            .overlay {
                RoundedRectangle(cornerRadius: Theme.buttonRadius)
                    .stroke(
                        isSelected ? Theme.navy : Theme.border,
                        lineWidth: isSelected ? 1.5 : 1
                    )
            }
        }
        .buttonStyle(.plain)
    }

    private func refresh() {
        guard let userId = store.currentUserId else { return }
        isRefreshing = true
        Task {
            _ = await store.loadRemote(userId: userId)
            isRefreshing = false
        }
    }
}
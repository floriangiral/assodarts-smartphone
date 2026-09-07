import SwiftUI

struct OnboardingChoiceView: View {
    @Environment(AppStore.self) private var store
    @State private var showsCreateClub = false
    @State private var isRefreshing = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                BrandMark(size: 72)
                Text(tr("Comment souhaitez-vous rejoindre Assodarts ?", "How would you like to join Assodarts?"))
                    .font(.title2.bold())
                    .foregroundStyle(Theme.ink)
                Text(tr("Choisissez une option. Vous pourrez modifier votre choix plus tard.", "Choose an option. You can change your choice later."))
                    .foregroundStyle(Theme.inkSecondary)
                VStack(spacing: 12) {
                    onboardingButton(title: tr("J'ai été invité(e) par mon club", "I was invited by my club"), detail: tr("Attendez que le bureau enregistre votre invitation avec cette adresse email.", "Wait for your club board to register your invitation with this email address."), symbol: "envelope.badge") { showsCreateClub = false }
                    onboardingButton(title: tr("Créer mon club", "Create my club"), detail: tr("Créez votre club et devenez automatiquement administrateur.", "Create your club and become an administrator automatically."), symbol: "plus.circle") { showsCreateClub = true }
                }
                if !showsCreateClub {
                    PrimaryButton(title: tr("Rafraîchir", "Refresh"), symbol: "arrow.clockwise", isEnabled: !isRefreshing, action: refresh)
                } else {
                    CreateClubView(onCancel: { showsCreateClub = false })
                }
                Spacer()
            }
            .padding(24)
            .assoCanvas()
            .navigationTitle(tr("Bienvenue", "Welcome"))
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func onboardingButton(title: String, detail: String, symbol: String, action: @escaping () -> Void) -> some View {
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
            .background(Theme.surface, in: .rect(cornerRadius: 14))
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
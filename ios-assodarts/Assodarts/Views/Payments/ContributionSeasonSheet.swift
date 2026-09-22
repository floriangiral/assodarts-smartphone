import SwiftUI

struct ContributionSeasonSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var seasonId: String = Self.defaultSeasonId
    @State private var label: String = Self.defaultSeasonLabel
    @State private var memberAmount: String = ""
    @State private var playerAmount: String = ""
    @State private var errorMessage: String?
    @State private var isSaving = false

    private static var defaultSeasonId: String {
        let year = Calendar.current.component(.year, from: .now)
        return "\(year)-\(year + 1)"
    }

    private static var defaultSeasonLabel: String {
        tr("contribution_season_default")
    }

    private var memberAmountCents: Int { parseAmount(memberAmount) }
    private var playerAmountCents: Int { parseAmount(playerAmount) }
    private var canSave: Bool {
        !seasonId.trimmingCharacters(in: .whitespaces).isEmpty
            && !label.trimmingCharacters(in: .whitespaces).isEmpty
            && memberAmountCents > 0
            && playerAmountCents > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("seasonal_contributions")) {
                    TextField(tr("season_label"), text: $label)
                    TextField(tr("season_id"), text: $seasonId)
                        .textInputAutocapitalization(.never)
                }

                Section(tr("contribution_amounts")) {
                    amountField(tr("member_contribution"), text: $memberAmount)
                    amountField(tr("player_license_contribution"), text: $playerAmount)
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Theme.red)
                    }
                }

                Section {
                    PrimaryButton(
                        title: isSaving ? tr("saving") : tr("save_draft"),
                        symbol: "square.and.arrow.down",
                        isEnabled: canSave && !isSaving
                    ) {
                        save(publish: false)
                    }
                    PrimaryButton(
                        title: isSaving ? tr("publishing") : tr("publish_contribution"),
                        symbol: "checkmark.seal",
                        isEnabled: canSave && !isSaving
                    ) {
                        save(publish: true)
                    }
                } footer: {
                    Text(tr("published_contribution_cannot_be_edited"))
                }
            }
            .navigationTitle(tr("seasonal_contributions"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
            }
            .onAppear { loadCurrentSeason() }
        }
    }

    private func amountField(_ title: String, text: Binding<String>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField(tr("0_00"), text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 100)
            Text("€")
                .foregroundStyle(Theme.inkSecondary)
        }
    }

    private func parseAmount(_ value: String) -> Int {
        Int(((Double(value.replacingOccurrences(of: ",", with: ".")) ?? 0) * 100).rounded())
    }

    private func loadCurrentSeason() {
        guard let season = store.currentContributionSeason else { return }
        seasonId = season.id
        label = season.label
        memberAmount = String(format: "%.2f", Double(season.memberAmountCents) / 100)
        playerAmount = String(format: "%.2f", Double(season.playerAmountCents) / 100)
    }

    private func save(publish: Bool) {
        guard canSave else { return }
        isSaving = true
        errorMessage = nil
        Task { @MainActor in
            var message = await store.saveContributionSeason(
                seasonId: seasonId,
                label: label,
                memberAmountCents: memberAmountCents,
                playerAmountCents: playerAmountCents
            )
            if message == nil && publish {
                message = await store.publishContributionSeason(seasonId: seasonId)
            }
            isSaving = false
            if let message {
                errorMessage = message
            } else {
                dismiss()
            }
        }
    }
}
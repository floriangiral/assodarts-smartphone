import SwiftUI

/// Create a developer coupon: 10 % up to 100 % (club offered), targeted clubs,
/// optional re-application at renewal.
struct NewCouponSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var code: String = ""
    @State private var percent: Double = 25
    @State private var expiresAt: Date = Calendar.current.date(byAdding: .month, value: 10, to: .now) ?? .now
    @State private var selection: Set<UUID> = []
    @State private var search: String = ""
    @State private var autoRenew: Bool = false

    private var clubs: [Club] {
        let all = store.platformClubs.sorted { $0.name < $1.name }
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return Array(all.prefix(12)) }
        return all.filter { $0.name.localizedStandardContains(query) }
    }

    private var roundedPercent: Int { Int(percent.rounded()) }

    private var canCreate: Bool {
        !code.trimmingCharacters(in: .whitespaces).isEmpty && !selection.isEmpty
    }

    private var previewLabel: String {
        let tier = PricingTier.all[1]
        let discounted = Coupon(
            code: "",
            percent: roundedPercent,
            expiresAt: .now,
            clubIds: [],
            autoRenew: false
        ).discountedCents(fromEuros: tier.priceEuros)
        if roundedPercent >= 100 {
            return "Formule \(tier.name) · abonnement offert"
        }
        return "Formule \(tier.name) · \(Fmt.euros(tier.priceEuros)) → \(Fmt.money(discounted))"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Code") {
                    TextField("Ex. RENTREE26", text: $code)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .monospaced()
                }

                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Réduction")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            Text(roundedPercent >= 100 ? "Offert" : "\(roundedPercent) %")
                                .font(.headline)
                                .monospacedDigit()
                                .foregroundStyle(roundedPercent >= 100 ? Theme.green : Theme.orange)
                        }
                        Slider(value: $percent, in: 10...100, step: 5)
                            .tint(Theme.navy)
                        HStack {
                            Text("10 %")
                            Spacer()
                            Text("Offert (100 %)")
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)

                        Text(previewLabel)
                            .font(.footnote.weight(.medium))
                            .monospacedDigit()
                            .foregroundStyle(Theme.navy)
                    }
                    .padding(.vertical, 4)

                    DatePicker("Valable jusqu'au", selection: $expiresAt, displayedComponents: .date)
                }

                Section {
                    TextField("Rechercher un club", text: $search)

                    ForEach(clubs) { club in
                        Button {
                            if selection.contains(club.id) {
                                selection.remove(club.id)
                            } else {
                                selection.insert(club.id)
                            }
                        } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(club.name)
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.ink)
                                    Text("\(store.memberCount(of: club)) membres · \(Fmt.euros(store.tier(for: club).priceEuros))/an")
                                        .font(.caption)
                                        .foregroundStyle(Theme.inkSecondary)
                                }
                                Spacer()
                                Image(systemName: selection.contains(club.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(
                                        selection.contains(club.id)
                                            ? Theme.navy
                                            : Theme.inkSecondary.opacity(0.4)
                                    )
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("Clubs ciblés · \(selection.count) sélectionné\(selection.count > 1 ? "s" : "")")
                } footer: {
                    Text("Le coupon est appliqué au prochain renouvellement des clubs sélectionnés.")
                }

                Section {
                    Toggle("Renouvellement automatique", isOn: $autoRenew)
                } footer: {
                    Text("Le coupon sera réappliqué à chaque renouvellement tant qu'il n'est pas révoqué.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .navigationTitle("Nouveau coupon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer", action: create)
                        .fontWeight(.semibold)
                        .disabled(!canCreate)
                }
            }
        }
    }

    private func create() {
        let coupon = Coupon(
            code: code.trimmingCharacters(in: .whitespaces).uppercased(),
            percent: roundedPercent,
            expiresAt: expiresAt,
            clubIds: Array(selection),
            autoRenew: autoRenew
        )
        store.createCoupon(coupon)
        dismiss()
    }
}

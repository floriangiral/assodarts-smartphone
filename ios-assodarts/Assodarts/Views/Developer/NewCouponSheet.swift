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
    @FocusState private var isEditing: Bool

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
            return tr(
                "Formule \(tier.name) · abonnement offert",
                "\(tier.name) plan · subscription free"
            )
        }
        return tr(
            "Formule \(tier.name) · \(Fmt.euros(tier.priceEuros)) → \(Fmt.money(discounted))",
            "\(tier.name) plan · \(Fmt.euros(tier.priceEuros)) → \(Fmt.money(discounted))"
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("Code", "Code")) {
                    TextField(tr("Ex. RENTREE26", "E.g. AUTUMN26"), text: $code)
                        .keyboardField(.code, submit: .done)
                        .focused($isEditing)
                        .monospaced()
                }

                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(tr("Réduction", "Discount"))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            Text(roundedPercent >= 100
                                ? tr("Offert", "Free")
                                : tr("\(roundedPercent) %", "\(roundedPercent)%"))
                                .font(.headline)
                                .monospacedDigit()
                                .foregroundStyle(roundedPercent >= 100 ? Theme.green : Theme.orange)
                        }
                        Slider(value: $percent, in: 10...100, step: 5)
                            .tint(Theme.navy)
                        HStack {
                            Text(tr("10 %", "10%"))
                            Spacer()
                            Text(tr("Offert (100 %)", "Free (100%)"))
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)

                        Text(previewLabel)
                            .font(.footnote.weight(.medium))
                            .monospacedDigit()
                            .foregroundStyle(Theme.navy)
                    }
                    .padding(.vertical, 4)

                    DatePicker(
                        tr("Valable jusqu'au", "Valid until"),
                        selection: $expiresAt,
                        displayedComponents: .date
                    )
                }

                Section {
                    TextField(tr("Rechercher un club", "Search for a club"), text: $search)
                        .keyboardField(.freeText, submit: .search)
                        .focused($isEditing)

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
                                    Text(tr(
                                        "\(store.memberCount(of: club)) membres · \(Fmt.euros(store.tier(for: club).priceEuros))/an",
                                        "\(store.memberCount(of: club)) members · \(Fmt.euros(store.tier(for: club).priceEuros))/year"
                                    ))
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
                    Text(tr(
                        "Clubs ciblés · \(selection.count) sélectionné\(selection.count > 1 ? "s" : "")",
                        "Targeted clubs · \(selection.count) selected"
                    ))
                } footer: {
                    Text(tr(
                        "Le coupon est appliqué au prochain renouvellement des clubs sélectionnés.",
                        "The coupon applies at the next renewal of the selected clubs."
                    ))
                }

                Section {
                    Toggle(tr("Renouvellement automatique", "Automatic renewal"), isOn: $autoRenew)
                } footer: {
                    Text(tr(
                        "Le coupon sera réappliqué à chaque renouvellement tant qu'il n'est pas révoqué.",
                        "The coupon will be re-applied at every renewal until it is revoked."
                    ))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditing) { isEditing = false }
            .navigationTitle(tr("Nouveau coupon", "New coupon"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("Annuler", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("Créer", "Create"), action: create)
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

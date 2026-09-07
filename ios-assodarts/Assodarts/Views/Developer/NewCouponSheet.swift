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
            return tr("plan_subscription_free \(tier.name)")
        }
        return tr("plan_newcouponsheet \(tier.name) \(Fmt.euros(tier.priceEuros)) \(Fmt.money(discounted))")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("code")) {
                    TextField(tr("e_g_autumn26"), text: $code)
                        .keyboardField(.code, submit: .done)
                        .focused($isEditing)
                        .monospaced()
                        .foregroundStyle(Theme.ink)
                }

                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(tr("discount"))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            Text(roundedPercent >= 100
                                ? tr("free")
                                : tr("discount_percent_new_coupon \(roundedPercent)"))
                                .font(.headline)
                                .monospacedDigit()
                                .foregroundStyle(roundedPercent >= 100 ? Theme.green : Theme.orange)
                        }
                        Slider(value: $percent, in: 10...100, step: 5)
                            .tint(Theme.navy)
                        HStack {
                            Text(tr("10"))
                            Spacer()
                            Text(tr("free_100"))
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
                        tr("valid_until"),
                        selection: $expiresAt,
                        displayedComponents: .date
                    )
                }

                Section {
                    TextField(tr("search_for_a_club"), text: $search)
                        .keyboardField(.freeText, submit: .search)
                        .focused($isEditing)
                        .foregroundStyle(Theme.ink)

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
                                    Text(tr("members_year \(club.seedMemberCount) \(Fmt.euros(store.tier(for: club).priceEuros))"))
                                        .font(.caption)
                                        .foregroundStyle(Theme.inkSecondary)
                                }
                                Spacer()
                                SelectionIndicator(isSelected: selection.contains(club.id))
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text(tr("selected_clubs_count \(selection.count)"))
                } footer: {
                    Text(tr("the_coupon_applies_at_the_next_renewal_of_the_selected_c"))
                }

                Section {
                    Toggle(tr("automatic_renewal"), isOn: $autoRenew)
                } footer: {
                    Text(tr("the_coupon_will_be_re_applied_at_every_renewal_until_it_"))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditing) { isEditing = false }
            .navigationTitle(tr("new_coupon"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(tr("create"), action: create)
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
        Task {
            await store.createCoupon(coupon)
            dismiss()
        }
    }
}

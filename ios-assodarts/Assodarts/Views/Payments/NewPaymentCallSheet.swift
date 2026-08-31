import SwiftUI

/// Bureau composer for a payment call, sent in bulk or to a single member.
struct NewPaymentCallSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var label: String = ""
    @State private var category: PaymentCategory = .cotisation
    @State private var amountText: String = ""
    @State private var dueDate: Date = Calendar.current.date(byAdding: .day, value: 30, to: .now) ?? .now
    @State private var audience: Audience = .everyone
    @State private var selection: Set<UUID> = []
    @State private var search: String = ""
    @State private var notify: Bool = true

    enum Audience: String, CaseIterable, Identifiable {
        case everyone
        case selection
        case single

        var id: String { rawValue }

        var label: String {
            switch self {
            case .everyone: "Tout le club"
            case .selection: "Sélection"
            case .single: "Un membre"
            }
        }
    }

    private var members: [Member] {
        guard let club = store.currentClub else { return [] }
        let all = store.members(of: club.id)
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return all }
        return all.filter { $0.fullName.localizedStandardContains(query) }
    }

    private var recipients: [UUID] {
        guard let club = store.currentClub else { return [] }
        switch audience {
        case .everyone: return store.members(of: club.id).map(\.id)
        case .selection, .single: return Array(selection)
        }
    }

    private var amountCents: Int {
        let normalized = amountText.replacingOccurrences(of: ",", with: ".")
        return Int(((Double(normalized) ?? 0) * 100).rounded())
    }

    private var totalCents: Int { amountCents * recipients.count }

    private var canSend: Bool {
        !label.trimmingCharacters(in: .whitespaces).isEmpty && amountCents > 0 && !recipients.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Intitulé") {
                    TextField("Ex. Tenue du club 2026", text: $label)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(PaymentCategory.allCases) { option in
                                Button {
                                    category = option
                                    if label.isEmpty { label = defaultLabel(for: option) }
                                } label: {
                                    Label(option.label, systemImage: option.symbol)
                                        .font(.caption.weight(.semibold))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .foregroundStyle(category == option ? .white : Theme.navy)
                                        .background(category == option ? Theme.navy : Theme.navyTint, in: .capsule)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                }

                Section("Montant et échéance") {
                    HStack {
                        Text("Montant")
                        Spacer()
                        TextField("0,00", text: $amountText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                            .frame(maxWidth: 110)
                        Text("€")
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    DatePicker("Échéance", selection: $dueDate, displayedComponents: .date)
                }

                Section("Destinataires") {
                    Picker("Destinataires", selection: $audience) {
                        ForEach(Audience.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: audience) { _, _ in selection.removeAll() }

                    switch audience {
                    case .everyone:
                        Label(
                            "\(recipients.count) membres du club",
                            systemImage: "person.3.fill"
                        )
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)

                    case .selection, .single:
                        Button {
                            selectLateMembers()
                        } label: {
                            Label("Cotisation non réglée (\(lateMemberIds.count))", systemImage: "wand.and.stars")
                                .font(.footnote.weight(.semibold))
                        }
                        .disabled(audience == .single || lateMemberIds.isEmpty)

                        TextField("Rechercher un membre", text: $search)

                        ForEach(members) { member in
                            Button {
                                toggle(member.id)
                            } label: {
                                HStack(spacing: 12) {
                                    AvatarView(
                                        initials: member.initials,
                                        photoData: member.photoData,
                                        size: 32
                                    )
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(member.fullName)
                                            .font(.subheadline)
                                            .foregroundStyle(Theme.ink)
                                        Text(member.role.label)
                                            .font(.caption)
                                            .foregroundStyle(Theme.inkSecondary)
                                    }
                                    Spacer()
                                    Image(systemName: selection.contains(member.id) ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(
                                            selection.contains(member.id)
                                                ? Theme.navy
                                                : Theme.inkSecondary.opacity(0.4)
                                        )
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section {
                    Toggle("Notifier par notification et email", isOn: $notify)
                } footer: {
                    Text("Chaque destinataire retrouvera l'appel dans « Mes paiements » et pourra régler "
                        + "par Apple Pay ou carte bancaire.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .navigationTitle("Nouvel appel à paiement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                PrimaryButton(
                    title: canSend
                        ? "Envoyer · \(recipients.count) membre\(recipients.count > 1 ? "s" : "") · \(Fmt.money(totalCents))"
                        : "Envoyer l'appel",
                    symbol: "paperplane.fill",
                    isEnabled: canSend,
                    action: send
                )
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(.bar)
            }
        }
    }

    private var lateMemberIds: [UUID] {
        guard let club = store.currentClub else { return [] }
        return store.members(of: club.id).filter { !store.isUpToDate($0.id) }.map(\.id)
    }

    private func selectLateMembers() {
        selection = Set(lateMemberIds)
    }

    private func toggle(_ id: UUID) {
        if audience == .single {
            selection = selection.contains(id) ? [] : [id]
            return
        }
        if selection.contains(id) {
            selection.remove(id)
        } else {
            selection.insert(id)
        }
    }

    private func defaultLabel(for category: PaymentCategory) -> String {
        switch category {
        case .cotisation: "Cotisation 2026–2027"
        case .tenue: "Tenue du club 2026"
        case .deplacement: "Déplacement"
        case .autre: ""
        }
    }

    private func send() {
        guard let club = store.currentClub, let user = store.currentUser else { return }
        let reference = "\(category.label.prefix(3).uppercased())-\(Calendar.current.component(.year, from: .now))-"
            + String(format: "%04d", Int.random(in: 1...9999))
        let call = PaymentCall(
            clubId: club.id,
            label: label.trimmingCharacters(in: .whitespaces),
            category: category,
            amountCents: amountCents,
            dueDate: dueDate,
            createdById: user.id,
            reference: reference,
            notify: notify,
            items: recipients.map { PaymentItem(memberId: $0) }
        )
        store.createPaymentCall(call)
        if notify {
            NotificationService.notify(
                title: "Nouvel appel à paiement",
                body: "\(call.label) · \(Fmt.money(call.amountCents)) à régler avant le \(Fmt.shortDate(call.dueDate))"
            )
        }
        dismiss()
    }
}

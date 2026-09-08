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
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case label
        case amount
        case search
    }

    enum Audience: String, CaseIterable, Identifiable {
        case everyone
        case selection
        case single

        var id: String { rawValue }

        var label: String {
            switch self {
            case .everyone: tr("whole_club")
            case .selection: tr("selection")
            case .single: tr("one_member")
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
                Section(tr("title_newpaymentcallsheet")) {
                    TextField(tr("e_g_club_kit_2026"), text: $label)
                        .keyboardField(.freeText, submit: .next)
                        .focused($focusedField, equals: .label)
                        .onSubmit { focusedField = .amount }
                        .foregroundStyle(Theme.ink)

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

                Section(tr("amount_and_due_date")) {
                    HStack {
                        Text(tr("amount"))
                        Spacer()
                        TextField(tr("0_00"), text: $amountText)
                            .keyboardField(.amount, submit: .done)
                            .focused($focusedField, equals: .amount)
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                            .foregroundStyle(Theme.ink)
                            .frame(maxWidth: 110)
                        Text("€")
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    DatePicker(tr("due_date"), selection: $dueDate, displayedComponents: .date)
                }

                Section(tr("recipients")) {
                    Picker(tr("recipients"), selection: $audience) {
                        ForEach(Audience.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: audience) { _, _ in selection.removeAll() }

                    switch audience {
                    case .everyone:
                        Label(
                            Fmt.count(recipients.count, key: .clubMembers),
                            systemImage: "person.3.fill"
                        )
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)

                    case .selection, .single:
                        Button {
                            selectLateMembers()
                        } label: {
                            Label(
                                tr("membership_fee_unpaid \(lateMemberIds.count)"),
                                systemImage: "wand.and.stars"
                            )
                                .font(.footnote.weight(.semibold))
                        }
                        .disabled(audience == .single || lateMemberIds.isEmpty)

                        TextField(tr("search_for_a_member"), text: $search)
                            .keyboardField(.name, submit: .search)
                            .focused($focusedField, equals: .search)
                            .foregroundStyle(Theme.ink)

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
                                    SelectionIndicator(isSelected: selection.contains(member.id))
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section {
                    Toggle(tr("notify_by_push_and_email"), isOn: $notify)
                } footer: {
                    Text(tr("each_recipient_will_find_the_request_under_my_payments_a"))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: focusedField != nil) { focusedField = nil }
            .navigationTitle(tr("new_payment_request"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                PrimaryButton(
                    title: canSend
                        ? tr("send_newpaymentcallsheet \(Fmt.count(recipients.count, key: .members)) \(Fmt.money(totalCents))")
                        : tr("send_request"),
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
        case .cotisation: tr("membership_fee_20262027")
        case .tenue: tr("club_kit_2026")
        case .deplacement: tr("travel")
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
                title: tr("new_payment_request"),
                body: tr("due_by \(call.label) \(Fmt.money(call.amountCents)) \(Fmt.shortDate(call.dueDate))")
            )
        }
        dismiss()
    }
}

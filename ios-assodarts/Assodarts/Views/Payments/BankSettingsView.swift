import SwiftUI

/// Where the bureau and the admin enter the club's bank details: the account
/// that receives the online payments, and the RIB members download when they
/// pay by transfer.
struct BankSettingsView: View {
    @Environment(AppStore.self) private var store

    @State private var draft: ClubBankAccount = ClubBankAccount()
    @State private var didLoad: Bool = false
    @State private var didSave: Bool = false
    @State private var isVerifying: Bool = false
    @State private var ribURL: URL?
    @State private var didCopyIban: Bool = false
    @State private var stripeSheet: IdentifiableURL?
    @State private var stripeError: String?
    @FocusState private var focus: FieldFocus?

    private enum FieldFocus: Hashable {
        case holder
        case iban
        case bic
        case bank
        case transferNote
        case cashNote
    }

    private var club: Club? { store.currentClub }

    private var canSave: Bool {
        draft.isComplete && draft != (club?.bank ?? ClubBankAccount())
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                if let club {
                    onlineCard(club)
                    detailsCard
                    methodsCard(club)
                    if draft.isComplete {
                        ribCard(club)
                    }
                    saveButton(club)
                } else {
                    EmptyStateView(
                        tr("club_not_found"),
                        systemImage: "building.columns"
                    )
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .assoCanvas()
        .keyboardDismissable()
        .keyboardDoneBar(isVisible: focus != nil) { focus = nil }
        .navigationTitle(tr("bank_details_admindashboardcontent"))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !didLoad else { return }
            draft = club?.bank ?? ClubBankAccount()
            didLoad = true
        }
        .sheet(item: $stripeSheet, onDismiss: refreshStripeStatus) { sheet in
            SafariSheet(url: sheet.url)
                .ignoresSafeArea()
        }
        .alert(
            tr("activation_failed"),
            isPresented: Binding(get: { stripeError != nil }, set: { if !$0 { stripeError = nil } })
        ) {
            Button(tr("close"), role: .cancel) { stripeError = nil }
        } message: {
            Text(stripeError ?? "")
        }
    }

    // MARK: - Online collection

    private func onlineCard(_ club: Club) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(tr("online_payments"))
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text(tr("apple_pay_google_pay_and_card_collected_through_stripe"))
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer(minLength: 8)
                StatusChip(
                    text: draft.stripeStatus.label,
                    tint: draft.stripeStatus.tint,
                    background: draft.stripeStatus.background,
                    symbol: draft.stripeStatus.symbol
                )
            }

            if draft.stripeStatus == .verified {
                HStack(spacing: 8) {
                    ForEach([PaymentMethodKind.applePay, .googlePay, .card]) { method in
                        Label(method.label, systemImage: method.symbol)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.navy)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 6)
                            .background(Theme.navyTint, in: .capsule)
                    }
                }

                if let accountId = draft.stripeAccountId {
                    Text(tr("stripe_account \(accountId)"))
                        .font(.caption2.monospaced())
                        .foregroundStyle(Theme.inkSecondary)
                }

                Button(tr("turn_off_online_payments")) {
                    store.disableOnlineCollection(for: club.id)
                    draft.stripeStatus = .notConnected
                    draft.stripeAccountId = nil
                }
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.red)
            } else {
                Text(draft.stripeStatus == .pending
                     ? tr("stripe_is_reviewing_the_club_s_information_resume_the_fo")
                     : tr("fill_in_the_club_account_below_then_activate_online_coll"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)

                PrimaryButton(
                    title: onlineCallToAction,
                    symbol: isVerifying ? nil : "bolt.fill",
                    isEnabled: draft.isComplete && !isVerifying
                ) {
                    activateOnlineCollection(club)
                }

                if !draft.isComplete {
                    Label(
                        tr("a_valid_iban_and_bic_are_required"),
                        systemImage: "info.circle"
                    )
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
        }
        .assoCard(padding: 18)
    }

    private var onlineCallToAction: String {
        if isVerifying {
            return tr("opening_stripe")
        }
        if draft.stripeStatus == .pending {
            return tr("resume_verification")
        }
        return tr("activate_online_collection")
    }

    /// Live clubs go through the real Stripe Connect onboarding; the demo mode
    /// keeps its simulated activation so the app stays explorable offline.
    private func activateOnlineCollection(_ club: Club) {
        store.saveBankAccount(draft, for: club.id, by: store.currentUser?.id)

        guard store.mode == .live else {
            simulateActivation(club)
            return
        }

        isVerifying = true
        Task {
            do {
                let onboarding = try await StripeService.startOnboarding(clubId: club.id)
                draft.stripeAccountId = onboarding.accountId
                draft.stripeStatus = onboarding.status
                stripeSheet = IdentifiableURL(url: onboarding.url)
            } catch {
                print("Stripe onboarding failed: \(error)")
                stripeError = friendlyMessage(for: error)
            }
            isVerifying = false
        }
    }

    /// Pulls the account state back from Stripe once the bureau closes the
    /// hosted form.
    private func refreshStripeStatus() {
        guard store.mode == .live, let club else { return }
        isVerifying = true
        Task {
            do {
                let status = try await StripeService.refreshStatus(clubId: club.id)
                withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                    draft.stripeStatus = status
                }
                switch status {
                case .verified:
                    store.completeOnlineCollection(for: club.id)
                    NotificationService.notify(
                        title: tr("online_payments_active"),
                        body: tr("your_members_can_now_pay_with_apple_pay_or_a_bank_card")
                    )
                case .pending:
                    store.startOnlineCollection(for: club.id)
                case .notConnected:
                    break
                }
                await store.refresh()
            } catch {
                print("Stripe status refresh failed: \(error)")
                stripeError = friendlyMessage(for: error)
            }
            isVerifying = false
        }
    }

    private func simulateActivation(_ club: Club) {
        store.startOnlineCollection(for: club.id)
        draft.stripeStatus = .pending
        draft.stripeAccountId = store.bankAccount(of: club.id)?.stripeAccountId
        isVerifying = true
        Task {
            try? await Task.sleep(for: .seconds(1.6))
            store.completeOnlineCollection(for: club.id)
            withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                draft.stripeStatus = .verified
                isVerifying = false
            }
            NotificationService.notify(
                title: tr("online_payments_active"),
                body: tr("your_members_can_now_pay_with_apple_pay_google_pay_or_ca")
            )
        }
    }

    // MARK: - Bank details

    private var detailsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel(text: tr("club_account"))

            field(
                tr("account_holder"),
                text: $draft.holder,
                placeholder: tr("e_g_lyon_darts_club"),
                kind: .name,
                focusValue: .holder
            )

            VStack(alignment: .leading, spacing: 6) {
                Text("IBAN")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.inkSecondary)
                TextField("FR76 3000 6000 0112 3456 7890 189", text: Binding(
                    get: { draft.iban },
                    set: { draft.iban = ClubBankAccount.group($0) }
                ))
                    .font(.subheadline.monospaced())
                    .keyboardField(.code, submit: .next)
                    .focused($focus, equals: .iban)
                    .foregroundStyle(Theme.ink)
                    .padding(12)
                    .background(Theme.canvas, in: .rect(cornerRadius: Theme.compactRadius))
                    .overlay {
                        RoundedRectangle(cornerRadius: Theme.compactRadius)
                            .stroke(ibanBorder, lineWidth: 1)
                    }

                if !draft.compactIban.isEmpty {
                    Label(
                        draft.isIbanValid
                            ? tr("valid_iban")
                            : tr("invalid_iban_check_the_entry"),
                        systemImage: draft.isIbanValid ? "checkmark.circle.fill" : "exclamationmark.circle.fill"
                    )
                        .font(.caption)
                        .foregroundStyle(draft.isIbanValid ? Theme.green : Theme.red)
                }
            }

            HStack(spacing: 12) {
                field(
                    "BIC / SWIFT",
                    text: $draft.bic,
                    placeholder: "AGRIFRPP",
                    kind: .code,
                    focusValue: .bic
                )
                field(
                    tr("bank"),
                    text: $draft.bankName,
                    placeholder: tr("e_g_barclays"),
                    kind: .name,
                    focusValue: .bank
                )
            }

            if let updatedAt = club?.bank?.updatedAt {
                if let updatedById = club?.bank?.updatedById {
                    Text(tr("last_updated_on_by \(Fmt.mediumDate(updatedAt)) \(store.memberName(updatedById))"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                } else {
                    Text(tr("last_updated_on \(Fmt.mediumDate(updatedAt))"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
        }
        .assoCard(padding: 18)
    }

    private var ibanBorder: Color {
        if draft.compactIban.isEmpty { return Theme.border }
        return draft.isIbanValid ? Theme.green.opacity(0.5) : Theme.red.opacity(0.6)
    }

    private func field(
        _ label: String,
        text: Binding<String>,
        placeholder: String,
        kind: KeyboardKit.Field,
        focusValue: FieldFocus
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary)
            TextField(placeholder, text: text)
                .font(.subheadline)
                .keyboardField(kind, submit: .next)
                .focused($focus, equals: focusValue)
                .foregroundStyle(Theme.ink)
                .padding(12)
                .background(Theme.canvas, in: .rect(cornerRadius: Theme.compactRadius))
        }
    }

    // MARK: - Accepted methods

    private func methodsCard(_ club: Club) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel(text: tr("methods_accepted_by_the_club"))

            Toggle(isOn: $draft.acceptsTransfer) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(PaymentMethodKind.transfer.label)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.ink)
                    Text(tr("the_member_downloads_the_bank_details_the_committee_conf"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .tint(Theme.navy)
            .disabled(!draft.isComplete)

            if draft.acceptsTransfer {
                TextField(
                    tr("transfer_instructions_optional"),
                    text: $draft.transferNote,
                    axis: .vertical
                )
                    .font(.footnote)
                    .lineLimit(2...4)
                    .keyboardField(.freeText, submit: .return)
                    .focused($focus, equals: .transferNote)
                    .foregroundStyle(Theme.ink)
                    .padding(12)
                    .background(Theme.canvas, in: .rect(cornerRadius: Theme.compactRadius))
            }

            Divider().overlay(Theme.border)

            Toggle(isOn: $draft.acceptsCash) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(PaymentMethodKind.cash.label)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.ink)
                    Text(tr("handed_over_in_person_the_committee_confirms_once_receiv"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .tint(Theme.navy)

            if draft.acceptsCash {
                TextField(
                    tr("where_to_hand_over_the_cash_optional"),
                    text: $draft.cashNote,
                    axis: .vertical
                )
                    .font(.footnote)
                    .lineLimit(2...4)
                    .keyboardField(.freeText, submit: .return)
                    .focused($focus, equals: .cashNote)
                    .foregroundStyle(Theme.ink)
                    .padding(12)
                    .background(Theme.canvas, in: .rect(cornerRadius: Theme.compactRadius))
            }

            if store.pendingValidationCount(of: club.id) > 0 {
                NavigationLink(value: ClubRoute.paymentValidation) {
                    HStack(spacing: 10) {
                        Image(systemName: "checkmark.circle.badge.questionmark")
                            .foregroundStyle(Theme.navy)
                        Text(Fmt.count(
                            store.pendingValidationCount(of: club.id),
                            key: .paymentsToConfirm
                        ))
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.navy)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.navy.opacity(0.6))
                    }
                    .padding(12)
                    .background(Theme.navyTint, in: .rect(cornerRadius: Theme.controlRadius))
                }
                .buttonStyle(.plain)
            }
        }
        .assoCard(padding: 18)
    }

    // MARK: - RIB

    private func ribCard(_ club: Club) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                SectionLabel(text: tr("bank_details_shared_with_members"))
                Spacer()
            }

            VStack(spacing: 10) {
                ForEach(RIBDocument.rows(club: club, account: draft), id: \.label) { row in
                    HStack(alignment: .top) {
                        Text(row.label)
                            .font(.caption)
                            .foregroundStyle(Theme.inkSecondary)
                        Spacer(minLength: 12)
                        Text(row.value)
                            .font(row.label == "IBAN" ? .caption.monospaced() : .caption.weight(.medium))
                            .multilineTextAlignment(.trailing)
                            .foregroundStyle(Theme.ink)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(Theme.canvas, in: .rect(cornerRadius: Theme.controlRadius))

            HStack(spacing: 10) {
                TintedActionButton(
                    title: didCopyIban ? tr("iban_copied") : tr("copy_iban"),
                    symbol: didCopyIban ? "checkmark" : "doc.on.doc",
                    foreground: Theme.navy,
                    background: Theme.navyTint
                ) {
                    UIPasteboard.general.string = draft.formattedIban
                    withAnimation { didCopyIban = true }
                    Task {
                        try? await Task.sleep(for: .seconds(2))
                        withAnimation { didCopyIban = false }
                    }
                }

                if let ribURL {
                    ShareLink(item: ribURL) {
                        ActionButtonLabel(
                            title: tr("share_details"),
                            symbol: "square.and.arrow.up",
                            foreground: Theme.navy,
                            background: Theme.navyTint
                        )
                    }
                } else {
                    TintedActionButton(
                        title: tr("generate_pdf"),
                        symbol: "doc.text",
                        foreground: Theme.navy,
                        background: Theme.navyTint
                    ) {
                        ribURL = RIBDocument.makePDF(club: club, account: draft, reference: nil)
                    }
                }
            }
        }
        .assoCard(padding: 18)
    }

    // MARK: - Save

    private func saveButton(_ club: Club) -> some View {
        VStack(spacing: 10) {
            PrimaryButton(
                title: didSave
                    ? tr("details_saved")
                    : tr("save"),
                symbol: didSave ? "checkmark" : nil,
                isEnabled: canSave
            ) {
                store.saveBankAccount(draft, for: club.id, by: store.currentUser?.id)
                ribURL = nil
                withAnimation { didSave = true }
                Task {
                    try? await Task.sleep(for: .seconds(2))
                    withAnimation { didSave = false }
                }
            }

            Text(tr("these_details_are_only_visible_to_the_committee_and_to_t"))
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.inkSecondary)
        }
    }
}

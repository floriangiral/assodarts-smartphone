import SwiftUI

/// Payment sheet offered to a member: instant payment through the club's online
/// account (Apple Pay, Google Pay, card), or a declared payment the bureau
/// confirms later (bank transfer with the club RIB, or cash).
struct PaySheet: View {
    let callId: UUID

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var method: PaymentMethodKind?
    @State private var phase: Phase = .ready
    @State private var reference: String = ""
    @State private var ribURL: URL?
    @State private var didCopyIban: Bool = false
    @State private var checkoutSheet: IdentifiableURL?
    @State private var checkoutError: String?
    @FocusState private var isEditingReference: Bool

    private enum Phase {
        case ready
        case processing
        case paid
        case declared
    }

    private var call: PaymentCall? { store.paymentCall(callId) }
    private var account: ClubBankAccount? { store.currentBankAccount }
    private var methods: [PaymentMethodKind] { account?.availableMethods ?? [] }

    private var onlineMethods: [PaymentMethodKind] { methods.filter(\.isOnline) }
    private var manualMethods: [PaymentMethodKind] { methods.filter(\.requiresValidation) }

    var body: some View {
        NavigationStack {
            Group {
                switch phase {
                case .paid:
                    outcomeView(isPaid: true)
                case .declared:
                    outcomeView(isPaid: false)
                default:
                    if let call {
                        content(call)
                    } else {
                        EmptyStateView(
                            tr("payment_not_found"),
                            systemImage: "eurosign.circle"
                        )
                    }
                }
            }
            .navigationTitle(phase == .paid || phase == .declared ? "" : tr("payment"))
            .navigationBarTitleDisplayMode(.inline)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditingReference) { isEditingReference = false }
            .toolbar {
                if phase == .ready || phase == .processing {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(tr("cancel")) { dismiss() }
                    }
                }
            }
            .onAppear {
                if method == nil { method = methods.first { $0.isAvailableOnThisDevice } }
            }
            .sheet(item: $checkoutSheet, onDismiss: settleCheckout) { sheet in
                SafariSheet(url: sheet.url)
                    .ignoresSafeArea()
            }
            .alert(
                tr("payment_failed"),
                isPresented: Binding(get: { checkoutError != nil }, set: { if !$0 { checkoutError = nil } })
            ) {
                Button(tr("close"), role: .cancel) { checkoutError = nil }
            } message: {
                Text(checkoutError ?? "")
            }
        }
    }

    // MARK: - Main content

    private func content(_ call: PaymentCall) -> some View {
        ScrollView {
            VStack(spacing: 18) {
                amountHeader(call)
                detailsCard(call)

                if methods.isEmpty {
                    noMethodCard
                } else {
                    if !onlineMethods.isEmpty {
                        methodGroup(
                            title: tr("instant_payment"),
                            footnote: tr("paid_straight_into_the_club_account"),
                            options: onlineMethods
                        )
                    }

                    if !manualMethods.isEmpty {
                        methodGroup(
                            title: tr("confirmed_by_the_committee"),
                            footnote: tr("your_payment_stays_pending_until_the_committee_confirms_"),
                            options: manualMethods
                        )
                    }

                    if method == .transfer, let account, let club = store.currentClub {
                        transferCard(club: club, account: account, call: call)
                    }

                    if method == .cash, let account {
                        cashCard(account)
                    }

                    payButton(call)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
        }
        .assoCanvas()
    }

    private func amountHeader(_ call: PaymentCall) -> some View {
        VStack(spacing: 10) {
            VStack(spacing: 6) {
                Text(call.label)
                    .font(.title3.bold())
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                Text(store.currentClub?.name ?? "")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
            .padding(.top, 8)

            VStack(spacing: 6) {
                MetricNumber(
                    value: Fmt.money(call.amountCents),
                    size: .prominent,
                    color: Theme.navy
                )
                Text(tr("due_by_paysheet \(Fmt.mediumDate(call.dueDate))"))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
    }

    private func detailsCard(_ call: PaymentCall) -> some View {
        VStack(spacing: 10) {
            detailRow(tr("payee"), store.currentClub?.shortName ?? "Club")
            Divider().overlay(Theme.border)
            detailRow(tr("category"), call.category.label)
            Divider().overlay(Theme.border)
            detailRow(tr("reference"), call.reference)
        }
        .assoCard()
    }

    private var noMethodCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(
                tr("no_payment_method_available"),
                systemImage: "exclamationmark.triangle.fill"
            )
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.amber)
            Text(tr("the_club_committee_has_not_entered_its_bank_details_yet_"))
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
        }
        .assoCard()
    }

    private func methodGroup(
        title: String,
        footnote: String,
        options: [PaymentMethodKind]
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: title)

            VStack(spacing: 0) {
                ForEach(options) { option in
                    let isUsable = option.isAvailableOnThisDevice
                    Button {
                        guard isUsable else { return }
                        withAnimation(.spring(response: 0.32, dampingFraction: 0.82)) { method = option }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: option.symbol)
                                .font(.subheadline)
                                .foregroundStyle(isUsable ? Theme.ink : Theme.inkSecondary.opacity(0.5))
                                .frame(width: 26)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(option.label)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(isUsable ? Theme.ink : Theme.inkSecondary)
                                Text(isUsable
                                     ? option.detail
                                     : tr("available_on_android"))
                                    .font(.caption)
                                    .foregroundStyle(Theme.inkSecondary)
                            }

                            Spacer(minLength: 4)

                            SelectionIndicator(
                                isSelected: method == option,
                                isEnabled: isUsable
                            )
                        }
                        .padding(.vertical, 10)
                    }
                    .buttonStyle(.plain)
                    .disabled(!isUsable)

                    if option != options.last {
                        Divider().overlay(Theme.border)
                    }
                }
            }
            .assoCard(padding: 14)

            Text(footnote)
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
        }
    }

    // MARK: - Transfer

    private func transferCard(club: Club, account: ClubBankAccount, call: PaymentCall) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel(text: tr("club_bank_details"))

            VStack(spacing: 10) {
                ForEach(RIBDocument.rows(club: club, account: account), id: \.label) { row in
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
                Divider().overlay(Theme.border)
                HStack(alignment: .top) {
                    Text(tr("reference_to_quote_paysheet"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer(minLength: 12)
                    Text(call.reference)
                        .font(.caption.monospaced().weight(.semibold))
                        .foregroundStyle(Theme.orange)
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
                    UIPasteboard.general.string = account.formattedIban
                    withAnimation { didCopyIban = true }
                    Task {
                        try? await Task.sleep(for: .seconds(2))
                        withAnimation { didCopyIban = false }
                    }
                }

                if let ribURL {
                    ShareLink(item: ribURL) {
                        ActionButtonLabel(
                            title: tr("download_details"),
                            symbol: "arrow.down.doc",
                            foreground: .white,
                            background: Theme.navy
                        )
                    }
                } else {
                    TintedActionButton(
                        title: tr("prepare_details"),
                        symbol: "doc.text",
                        foreground: .white,
                        background: Theme.navy
                    ) {
                        ribURL = RIBDocument.makePDF(
                            club: club,
                            account: account,
                            reference: call.reference
                        )
                    }
                }
            }

            if !account.transferNote.trimmingCharacters(in: .whitespaces).isEmpty {
                Text(account.transferNote)
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            referenceField(
                placeholder: tr("label_of_your_transfer_optional")
            )
        }
        .assoCard()
    }

    private func cashCard(_ account: ClubBankAccount) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("cash_payment"))

            Text(account.cashNote.trimmingCharacters(in: .whitespaces).isEmpty
                 ? tr("hand_the_cash_to_a_committee_member_then_declare_it_here")
                 : account.cashNote)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)

            referenceField(
                placeholder: tr("who_did_you_hand_the_cash_to_optional")
            )
        }
        .assoCard()
    }

    private func referenceField(placeholder: String) -> some View {
        TextField(placeholder, text: $reference, axis: .vertical)
            .font(.footnote)
            .lineLimit(1...3)
            .keyboardField(.freeText, submit: .done)
            .focused($isEditingReference)
            .foregroundStyle(Theme.ink)
            .padding(12)
            .background(Theme.canvas, in: .rect(cornerRadius: Theme.compactRadius))
    }

    // MARK: - Call to action

    private func payButton(_ call: PaymentCall) -> some View {
        VStack(spacing: 12) {
            Button(action: submit) {
                HStack(spacing: 8) {
                    if phase == .processing {
                        ProgressView().tint(.white)
                    } else if let method {
                        Image(systemName: method.symbol)
                    }
                    Text(ctaTitle(call))
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .foregroundStyle(.white)
                .background(ctaBackground)
                .clipShape(.rect(cornerRadius: Theme.buttonRadius))
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(phase == .processing || method == nil)

            Label(
                method?.requiresValidation == true
                    ? tr("the_committee_receives_your_declaration_immediately")
                    : tr("secure_payment_receipt_sent_by_email"),
                systemImage: method?.requiresValidation == true ? "clock.badge.checkmark" : "lock.shield"
            )
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
        }
        .padding(.top, 4)
    }

    private func ctaTitle(_ call: PaymentCall) -> String {
        switch method {
        case .applePay:
            return tr("pay_with_apple_pay")
        case .googlePay:
            return tr("pay_with_google_pay")
        case .card:
            return tr("pay \(Fmt.money(call.amountCents))")
        case .transfer:
            return tr("i_have_made_the_transfer")
        case .cash:
            return tr("i_have_handed_over_the_cash")
        case nil:
            return tr("choose_a_payment_method")
        }
    }

    private var ctaBackground: Color {
        guard let method else { return Theme.navy.opacity(0.4) }
        if method == .applePay { return .black }
        if method.requiresValidation { return Theme.orange }
        return Theme.navy
    }

    private func submit() {
        guard let call, let user = store.currentUser, let method, phase == .ready else { return }
        isEditingReference = false

        if method.requiresValidation {
            store.declarePayment(
                callId: call.id,
                memberId: user.id,
                method: method,
                reference: reference.isEmpty ? call.reference : reference
            )
            NotificationService.notify(
                title: tr("payment_declared"),
                body: tr("awaiting_the_committee_s_confirmation \(call.label)")
            )
            withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) { phase = .declared }
            return
        }

        phase = .processing

        // Live clubs are charged through Stripe Checkout, which handles Apple Pay
        // and card entry outside the app. Demo mode keeps a simulated payment.
        guard store.mode == .live, let item = call.item(for: user.id) else {
            Task {
                try? await Task.sleep(for: .seconds(1.2))
                store.markPaid(callId: call.id, memberId: user.id, method: method)
                NotificationService.notify(
                    title: tr("payment_confirmed"),
                    body: "\(call.label) · \(Fmt.money(call.amountCents))"
                )
                withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { phase = .paid }
            }
            return
        }

        Task {
            do {
                let url = try await StripeService.createCheckout(itemId: item.id)
                checkoutSheet = IdentifiableURL(url: url)
            } catch {
                print("Checkout creation failed: \(error)")
                checkoutError = friendlyMessage(for: error)
                phase = .ready
            }
        }
    }

    /// Called when the Stripe page is closed. The webhook is the source of truth,
    /// so the app simply re-reads the line and reacts to what the server says.
    private func settleCheckout() {
        guard let call, let user = store.currentUser else { return }

        Task {
            // Give the webhook a brief head start before the first read.
            try? await Task.sleep(for: .milliseconds(900))
            await store.refresh()

            var isPaid = store.paymentCall(call.id)?.item(for: user.id)?.isPaid ?? false
            if !isPaid {
                try? await Task.sleep(for: .seconds(2))
                await store.refresh()
                isPaid = store.paymentCall(call.id)?.item(for: user.id)?.isPaid ?? false
            }

            if isPaid {
                NotificationService.notify(
                    title: tr("payment_confirmed"),
                    body: "\(call.label) · \(Fmt.money(call.amountCents))"
                )
                withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { phase = .paid }
            } else {
                withAnimation { phase = .ready }
            }
        }
    }

    // MARK: - Outcome

    private func outcomeView(isPaid: Bool) -> some View {
        VStack(spacing: 18) {
            Spacer()

            Image(systemName: isPaid ? "checkmark.circle.fill" : "clock.badge.checkmark.fill")
                .font(.system(size: 78))
                .foregroundStyle(isPaid ? Theme.green : Theme.orange)
                .transition(.scale.combined(with: .opacity))

            Text(isPaid
                 ? tr("payment_confirmed")
                 : tr("payment_awaiting_confirmation"))
                .font(.title2.bold())
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.ink)

            if let call {
                Text("\(Fmt.money(call.amountCents)) · \(call.label)")
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary)
            }

            Text(isPaid
                 ? tr("a_receipt_has_just_been_emailed_to_you")
                 : tr("the_committee_has_been_notified_your_payment_will_be_mar"))
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.inkSecondary)
                .padding(.horizontal, 24)

            Spacer()

            PrimaryButton(title: tr("done")) { dismiss() }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity)
        .assoCanvas()
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.ink)
        }
    }
}

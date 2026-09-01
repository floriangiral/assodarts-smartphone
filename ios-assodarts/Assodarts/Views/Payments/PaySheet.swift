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
                        ContentUnavailableView(
                            tr("Paiement introuvable", "Payment not found"),
                            systemImage: "eurosign.circle"
                        )
                    }
                }
            }
            .navigationTitle(phase == .paid || phase == .declared ? "" : tr("Paiement", "Payment"))
            .navigationBarTitleDisplayMode(.inline)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: isEditingReference) { isEditingReference = false }
            .toolbar {
                if phase == .ready || phase == .processing {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(tr("Annuler", "Cancel")) { dismiss() }
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
                tr("Paiement impossible", "Payment failed"),
                isPresented: Binding(get: { checkoutError != nil }, set: { if !$0 { checkoutError = nil } })
            ) {
                Button(tr("Fermer", "Close"), role: .cancel) { checkoutError = nil }
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
                            title: tr("Paiement immédiat", "Instant payment"),
                            footnote: tr(
                                "Encaissé directement sur le compte du club.",
                                "Paid straight into the club account."
                            ),
                            options: onlineMethods
                        )
                    }

                    if !manualMethods.isEmpty {
                        methodGroup(
                            title: tr("À valider par le bureau", "Confirmed by the committee"),
                            footnote: tr(
                                "Votre paiement passe en attente jusqu'à la validation du bureau.",
                                "Your payment stays pending until the committee confirms it."
                            ),
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
                Text(Fmt.money(call.amountCents))
                    .font(.system(size: 46, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Theme.navy)
                Text(tr(
                    "À régler avant le \(Fmt.mediumDate(call.dueDate))",
                    "Due by \(Fmt.mediumDate(call.dueDate))"
                ))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
    }

    private func detailsCard(_ call: PaymentCall) -> some View {
        VStack(spacing: 10) {
            detailRow(tr("Bénéficiaire", "Payee"), store.currentClub?.shortName ?? "Club")
            Divider().overlay(Theme.border)
            detailRow(tr("Catégorie", "Category"), call.category.label)
            Divider().overlay(Theme.border)
            detailRow(tr("Référence", "Reference"), call.reference)
        }
        .assoCard()
    }

    private var noMethodCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(
                tr("Aucun moyen de paiement disponible", "No payment method available"),
                systemImage: "exclamationmark.triangle.fill"
            )
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.amber)
            Text(tr(
                "Le bureau du club n'a pas encore renseigné ses coordonnées bancaires. "
                    + "Contactez-le depuis la messagerie pour régler autrement.",
                "The club committee has not entered its bank details yet. "
                    + "Message them from the app to arrange your payment."
            ))
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
                                     : tr("Disponible sur Android", "Available on Android"))
                                    .font(.caption)
                                    .foregroundStyle(Theme.inkSecondary)
                            }

                            Spacer(minLength: 4)

                            Image(systemName: method == option ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(method == option ? Theme.navy : Theme.inkSecondary.opacity(0.35))
                                .opacity(isUsable ? 1 : 0.3)
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
            SectionLabel(text: tr("Coordonnées du club", "Club bank details"))

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
                    Text(tr("Référence à indiquer", "Reference to quote"))
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
            .background(Theme.canvas, in: .rect(cornerRadius: 12))

            HStack(spacing: 10) {
                Button {
                    UIPasteboard.general.string = account.formattedIban
                    withAnimation { didCopyIban = true }
                    Task {
                        try? await Task.sleep(for: .seconds(2))
                        withAnimation { didCopyIban = false }
                    }
                } label: {
                    Label(
                        didCopyIban ? tr("IBAN copié", "IBAN copied") : tr("Copier l'IBAN", "Copy IBAN"),
                        systemImage: didCopyIban ? "checkmark" : "doc.on.doc"
                    )
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.navy)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Theme.navyTint, in: .rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())

                if let ribURL {
                    ShareLink(item: ribURL) {
                        Label(tr("Télécharger le RIB", "Download details"), systemImage: "arrow.down.doc")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(Theme.navy, in: .rect(cornerRadius: 12))
                    }
                } else {
                    Button {
                        ribURL = RIBDocument.makePDF(
                            club: club,
                            account: account,
                            reference: call.reference
                        )
                    } label: {
                        Label(tr("Préparer le RIB", "Prepare details"), systemImage: "doc.text")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(Theme.navy, in: .rect(cornerRadius: 12))
                    }
                    .buttonStyle(PressableButtonStyle())
                }
            }

            if !account.transferNote.trimmingCharacters(in: .whitespaces).isEmpty {
                Text(account.transferNote)
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }

            referenceField(
                placeholder: tr(
                    "Libellé de votre virement (optionnel)",
                    "Label of your transfer (optional)"
                )
            )
        }
        .assoCard()
    }

    private func cashCard(_ account: ClubBankAccount) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: tr("Paiement en espèces", "Cash payment"))

            Text(account.cashNote.trimmingCharacters(in: .whitespaces).isEmpty
                 ? tr(
                    "Remettez le montant en espèces à un membre du bureau, puis déclarez-le ici. "
                        + "Le bureau validera après encaissement.",
                    "Hand the cash to a committee member, then declare it here. "
                        + "The committee will confirm once received."
                 )
                 : account.cashNote)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)

            referenceField(
                placeholder: tr(
                    "À qui avez-vous remis les espèces ? (optionnel)",
                    "Who did you hand the cash to? (optional)"
                )
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
            .padding(12)
            .background(Theme.canvas, in: .rect(cornerRadius: 10))
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
                .clipShape(.rect(cornerRadius: 14))
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(phase == .processing || method == nil)

            Label(
                method?.requiresValidation == true
                    ? tr(
                        "Le bureau reçoit votre déclaration immédiatement.",
                        "The committee receives your declaration immediately."
                    )
                    : tr(
                        "Paiement sécurisé · reçu envoyé par email",
                        "Secure payment · receipt sent by email"
                    ),
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
            return tr("Payer avec Apple Pay", "Pay with Apple Pay")
        case .googlePay:
            return tr("Payer avec Google Pay", "Pay with Google Pay")
        case .card:
            return tr("Payer \(Fmt.money(call.amountCents))", "Pay \(Fmt.money(call.amountCents))")
        case .transfer:
            return tr("J'ai effectué le virement", "I have made the transfer")
        case .cash:
            return tr("J'ai remis les espèces", "I have handed over the cash")
        case nil:
            return tr("Choisir un moyen de paiement", "Choose a payment method")
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
                title: tr("Paiement déclaré", "Payment declared"),
                body: tr(
                    "\(call.label) · en attente de validation du bureau.",
                    "\(call.label) · awaiting the committee's confirmation."
                )
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
                    title: tr("Paiement confirmé", "Payment confirmed"),
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
                    title: tr("Paiement confirmé", "Payment confirmed"),
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
                 ? tr("Paiement confirmé", "Payment confirmed")
                 : tr("Paiement en attente de validation", "Payment awaiting confirmation"))
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
                 ? tr(
                    "Un reçu vient de vous être envoyé par email.",
                    "A receipt has just been emailed to you."
                 )
                 : tr(
                    "Le bureau a été prévenu. Votre paiement sera marqué comme payé dès qu'il aura constaté la réception.",
                    "The committee has been notified. Your payment will be marked as paid as soon as they confirm receipt."
                 ))
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.inkSecondary)
                .padding(.horizontal, 24)

            Spacer()

            PrimaryButton(title: tr("Terminé", "Done")) { dismiss() }
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

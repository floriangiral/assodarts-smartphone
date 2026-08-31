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
                    ContentUnavailableView(
                        tr("Club introuvable", "Club not found"),
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
        .navigationTitle(tr("Coordonnées bancaires", "Bank details"))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !didLoad else { return }
            draft = club?.bank ?? ClubBankAccount()
            didLoad = true
        }
    }

    // MARK: - Online collection

    private func onlineCard(_ club: Club) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(tr("Paiements en ligne", "Online payments"))
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text(tr(
                        "Apple Pay, Google Pay et carte bancaire, encaissés via Stripe.",
                        "Apple Pay, Google Pay and card, collected through Stripe."
                    ))
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
                    Text(tr("Compte Stripe \(accountId)", "Stripe account \(accountId)"))
                        .font(.caption2.monospaced())
                        .foregroundStyle(Theme.inkSecondary)
                }

                Button(tr("Désactiver les paiements en ligne", "Turn off online payments")) {
                    store.disableOnlineCollection(for: club.id)
                    draft.stripeStatus = .notConnected
                    draft.stripeAccountId = nil
                }
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.red)
            } else {
                Text(tr(
                    "Renseignez le compte du club ci-dessous, puis activez l'encaissement en ligne. "
                        + "Les fonds sont versés sur ce compte.",
                    "Fill in the club account below, then activate online collection. "
                        + "Payouts are sent to that account."
                ))
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)

                PrimaryButton(
                    title: isVerifying
                        ? tr("Vérification en cours…", "Verification in progress…")
                        : tr("Activer l'encaissement en ligne", "Activate online collection"),
                    symbol: isVerifying ? nil : "bolt.fill",
                    isEnabled: draft.isComplete && !isVerifying
                ) {
                    activateOnlineCollection(club)
                }

                if !draft.isComplete {
                    Label(
                        tr("IBAN et BIC valides requis", "A valid IBAN and BIC are required"),
                        systemImage: "info.circle"
                    )
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
        }
        .assoCard(padding: 18)
    }

    private func activateOnlineCollection(_ club: Club) {
        store.saveBankAccount(draft, for: club.id, by: store.currentUser?.id)
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
                title: tr("Paiements en ligne actifs", "Online payments active"),
                body: tr(
                    "Vos membres peuvent régler par Apple Pay, Google Pay ou carte.",
                    "Your members can now pay with Apple Pay, Google Pay or card."
                )
            )
        }
    }

    // MARK: - Bank details

    private var detailsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel(text: tr("Compte du club", "Club account"))

            field(
                tr("Titulaire du compte", "Account holder"),
                text: $draft.holder,
                placeholder: tr("Ex. Fléchettes Club de Lyon", "E.g. Lyon Darts Club"),
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
                    .padding(12)
                    .background(Theme.canvas, in: .rect(cornerRadius: 10))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(ibanBorder, lineWidth: 1)
                    }

                if !draft.compactIban.isEmpty {
                    Label(
                        draft.isIbanValid
                            ? tr("IBAN valide", "Valid IBAN")
                            : tr("IBAN incorrect — vérifiez la saisie", "Invalid IBAN — check the entry"),
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
                    tr("Banque", "Bank"),
                    text: $draft.bankName,
                    placeholder: tr("Ex. Crédit Agricole", "E.g. Barclays"),
                    kind: .name,
                    focusValue: .bank
                )
            }

            if let updatedAt = club?.bank?.updatedAt {
                Text(tr(
                    "Dernière mise à jour le \(Fmt.mediumDate(updatedAt))"
                        + (club?.bank?.updatedById.map { " par \(store.memberName($0))" } ?? ""),
                    "Last updated on \(Fmt.mediumDate(updatedAt))"
                        + (club?.bank?.updatedById.map { " by \(store.memberName($0))" } ?? "")
                ))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
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
                .padding(12)
                .background(Theme.canvas, in: .rect(cornerRadius: 10))
        }
    }

    // MARK: - Accepted methods

    private func methodsCard(_ club: Club) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel(text: tr("Moyens acceptés par le club", "Methods accepted by the club"))

            Toggle(isOn: $draft.acceptsTransfer) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(PaymentMethodKind.transfer.label)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.ink)
                    Text(tr(
                        "Le membre télécharge le RIB, le bureau valide à réception.",
                        "The member downloads the bank details, the committee confirms on receipt."
                    ))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .tint(Theme.navy)
            .disabled(!draft.isComplete)

            if draft.acceptsTransfer {
                TextField(
                    tr("Consigne pour le virement (optionnel)", "Transfer instructions (optional)"),
                    text: $draft.transferNote,
                    axis: .vertical
                )
                    .font(.footnote)
                    .lineLimit(2...4)
                    .keyboardField(.freeText, submit: .return)
                    .focused($focus, equals: .transferNote)
                    .padding(12)
                    .background(Theme.canvas, in: .rect(cornerRadius: 10))
            }

            Divider().overlay(Theme.border)

            Toggle(isOn: $draft.acceptsCash) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(PaymentMethodKind.cash.label)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.ink)
                    Text(tr(
                        "Remise en main propre, le bureau valide après encaissement.",
                        "Handed over in person, the committee confirms once received."
                    ))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .tint(Theme.navy)

            if draft.acceptsCash {
                TextField(
                    tr("Où remettre les espèces (optionnel)", "Where to hand over the cash (optional)"),
                    text: $draft.cashNote,
                    axis: .vertical
                )
                    .font(.footnote)
                    .lineLimit(2...4)
                    .keyboardField(.freeText, submit: .return)
                    .focused($focus, equals: .cashNote)
                    .padding(12)
                    .background(Theme.canvas, in: .rect(cornerRadius: 10))
            }

            if store.pendingValidationCount(of: club.id) > 0 {
                NavigationLink(value: ClubRoute.paymentValidation) {
                    HStack(spacing: 10) {
                        Image(systemName: "checkmark.circle.badge.questionmark")
                            .foregroundStyle(Theme.navy)
                        Text(Fmt.count(
                            store.pendingValidationCount(of: club.id),
                            "paiement à valider",
                            "paiements à valider",
                            "payment to confirm",
                            "payments to confirm"
                        ))
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.navy)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.navy.opacity(0.6))
                    }
                    .padding(12)
                    .background(Theme.navyTint, in: .rect(cornerRadius: 12))
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
                SectionLabel(text: tr("RIB transmis aux membres", "Bank details shared with members"))
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
            .background(Theme.canvas, in: .rect(cornerRadius: 12))

            HStack(spacing: 10) {
                Button {
                    UIPasteboard.general.string = draft.formattedIban
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
                        Label(tr("Partager le RIB", "Share details"), systemImage: "square.and.arrow.up")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.navy)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(Theme.navyTint, in: .rect(cornerRadius: 12))
                    }
                } else {
                    Button {
                        ribURL = RIBDocument.makePDF(club: club, account: draft, reference: nil)
                    } label: {
                        Label(tr("Générer le PDF", "Generate PDF"), systemImage: "doc.text")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.navy)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(Theme.navyTint, in: .rect(cornerRadius: 12))
                    }
                    .buttonStyle(PressableButtonStyle())
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
                    ? tr("Coordonnées enregistrées", "Details saved")
                    : tr("Enregistrer", "Save"),
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

            Text(tr(
                "Ces informations ne sont visibles que par le bureau et par les membres de votre club.",
                "These details are only visible to the committee and to the members of your club."
            ))
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.inkSecondary)
        }
    }
}

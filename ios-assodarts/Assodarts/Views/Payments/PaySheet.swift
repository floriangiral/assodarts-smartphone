import SwiftUI

/// Native-feeling payment sheet: amount, details, payment method and confirmation.
struct PaySheet: View {
    let callId: UUID

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var method: PaymentMethod = .applePay
    @State private var phase: Phase = .ready

    private enum Phase {
        case ready
        case processing
        case done
    }

    enum PaymentMethod: String, CaseIterable, Identifiable {
        case applePay
        case card

        var id: String { rawValue }

        var label: String {
            switch self {
            case .applePay: "Apple Pay"
            case .card: "Carte bancaire ····4242"
            }
        }

        var symbol: String {
            switch self {
            case .applePay: "apple.logo"
            case .card: "creditcard.fill"
            }
        }
    }

    private var call: PaymentCall? { store.paymentCall(callId) }

    var body: some View {
        NavigationStack {
            Group {
                if phase == .done {
                    successView
                } else if let call {
                    content(call)
                } else {
                    ContentUnavailableView("Paiement introuvable", systemImage: "eurosign.circle")
                }
            }
            .navigationTitle(phase == .done ? "" : "Paiement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if phase != .done {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Annuler") { dismiss() }
                    }
                }
            }
        }
    }

    private func content(_ call: PaymentCall) -> some View {
        ScrollView {
            VStack(spacing: 18) {
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
                    Text("À régler avant le \(Fmt.mediumDate(call.dueDate))")
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }

                VStack(spacing: 10) {
                    detailRow("Bénéficiaire", store.currentClub?.shortName ?? "Club")
                    Divider().overlay(Theme.border)
                    detailRow("Catégorie", call.category.label)
                    Divider().overlay(Theme.border)
                    detailRow("Référence", call.reference)
                }
                .assoCard()

                VStack(alignment: .leading, spacing: 10) {
                    SectionLabel(text: "Moyen de paiement")
                    ForEach(PaymentMethod.allCases) { option in
                        Button {
                            method = option
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: option.symbol)
                                    .foregroundStyle(Theme.ink)
                                    .frame(width: 24)
                                Text(option.label)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.ink)
                                Spacer()
                                Image(systemName: method == option ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(method == option ? Theme.navy : Theme.inkSecondary.opacity(0.4))
                            }
                            .padding(.vertical, 8)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .assoCard()

                VStack(spacing: 12) {
                    Button(action: pay) {
                        HStack(spacing: 8) {
                            if phase == .processing {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Image(systemName: method.symbol)
                            }
                            Text(method == .applePay ? "Payer avec Apple Pay" : "Payer \(Fmt.money(call.amountCents))")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .foregroundStyle(.white)
                        .background(method == .applePay ? Color.black : Theme.navy)
                        .clipShape(.rect(cornerRadius: 14))
                    }
                    .buttonStyle(PressableButtonStyle())
                    .disabled(phase == .processing)

                    Text("Reçu envoyé par email · paiement sécurisé")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .assoCanvas()
    }

    private var successView: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 78))
                .foregroundStyle(Theme.green)
                .transition(.scale.combined(with: .opacity))
            Text("Paiement confirmé")
                .font(.title2.bold())
                .foregroundStyle(Theme.ink)
            if let call {
                Text("\(Fmt.money(call.amountCents)) · \(call.label)")
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary)
            }
            Text("Un reçu vient de vous être envoyé par email.")
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
            Spacer()
            PrimaryButton(title: "Terminé") { dismiss() }
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

    private func pay() {
        guard let call, let user = store.currentUser, phase == .ready else { return }
        phase = .processing
        Task {
            try? await Task.sleep(for: .seconds(1.2))
            store.markPaid(callId: call.id, memberId: user.id)
            NotificationService.notify(
                title: "Paiement confirmé",
                body: "\(call.label) · \(Fmt.money(call.amountCents))"
            )
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                phase = .done
            }
        }
    }
}

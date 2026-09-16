import SwiftUI
import CoreImage.CIFilterBuiltins
import UIKit

/// Registers a pending invitation for an email address. The member profile is
/// created by the invited person when they sign up with that email.
struct InviteMemberSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var email: String = ""
    @State private var invitation: RemoteRepository.Invitation?
    @State private var isSending: Bool = false
    @State private var didCopy: Bool = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email
    }

    private var canInvite: Bool {
        email.trimmingCharacters(in: .whitespacesAndNewlines).contains("@")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(tr("email_address")) {
                    TextField(tr("email"), text: $email)
                        .keyboardField(.email, submit: .done)
                        .focused($focusedField, equals: .email)
                        .onSubmit { focusedField = nil }
                        .foregroundStyle(Theme.ink)
                }

                Section {
                    Button {
                        invite()
                    } label: {
                        Label(isSending ? tr("sending") : tr("send_invitation"), systemImage: "paperplane.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(!canInvite || isSending)
                } footer: {
                    Text(tr("the_member_receives_an_invitation_email_with_a_temporary"))
                }

                if let invitation {
                    Section {
                        if let url = invitation.inviteURL {
                            QRCodeImage(url: url)
                                .frame(maxWidth: .infinity)
                                .listRowBackground(Color.clear)

                            Text(url.absoluteString)
                                .font(.footnote)
                                .foregroundStyle(Theme.inkSecondary)
                                .textSelection(.enabled)

                            ShareLink(item: url) {
                                Label(tr("share_invitation_link"), systemImage: "square.and.arrow.up")
                            }

                            Button {
                                UIPasteboard.general.string = url.absoluteString
                                didCopy = true
                            } label: {
                                Label(
                                    didCopy ? tr("invitation_link_copied") : tr("copy_invitation_link"),
                                    systemImage: didCopy ? "checkmark" : "doc.on.doc"
                                )
                            }
                        }

                        if !invitation.inviteCode.isEmpty {
                            LabeledContent(tr("invitation_code"), value: invitation.inviteCode)
                        }
                    } header: {
                        Text(tr("invitation_link"))
                    } footer: {
                        Text(tr("the_invited_person_can_scan_this_code_or_create_an_account"))
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.canvas)
            .keyboardDismissable()
            .keyboardDoneBar(isVisible: focusedField != nil) { focusedField = nil }
            .navigationTitle(tr("invite_a_member"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(tr("cancel")) { dismiss() }
                }
            }
        }
    }

    private func invite() {
        guard let club = store.currentClub else { return }
        isSending = true
        didCopy = false
        Task { @MainActor in
            invitation = await store.inviteMember(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                to: club.id
            )
            isSending = false
        }
    }
}

private struct QRCodeImage: View {
    let url: URL

    private let context = CIContext()
    private let filter = CIFilter.qrCodeGenerator()

    var body: some View {
        if let image = makeImage() {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
                .frame(width: 190, height: 190)
                .padding(16)
                .background(Theme.surface, in: .rect(cornerRadius: Theme.cardRadius))
                .overlay {
                    RoundedRectangle(cornerRadius: Theme.cardRadius)
                        .stroke(Theme.border, lineWidth: 1)
                }
        }
    }

    private func makeImage() -> UIImage? {
        filter.message = Data(url.absoluteString.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
              let cgImage = context.createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

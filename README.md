# Assodarts

Assodarts is an iOS app for running darts clubs. It gives club members a shared place for announcements, events, tournaments, messages, membership payments, and notifications. Club boards manage their own club data and can collect online payments through Stripe Connect.

The project is split into a native SwiftUI application and Firebase Cloud Functions. It can be explored offline with seeded demo data; a configured Firebase project enables authentication and live club data.

## Features

### Members

- Sign in with email and password when the backend is configured.
- Browse club announcements, upcoming events, tournaments, and member details.
- RSVP to events, enter tournaments, and follow payment requests.
- Send direct messages or contact the club board.
- Receive local reminders and register for push notifications through Firebase Cloud Messaging.
- Pay eligible payment lines with a hosted Stripe Checkout page.

### Club board

- Publish and pin announcements.
- Create events, tournaments, tournament entries, members, and payment calls.
- Record cash and transfer payments.
- Maintain bank details and payment methods for the club.
- Onboard the club to Stripe Connect and check its payment capability status.

### Platform

- A developer-only console for platform administration, broadcasts, and coupons.
- Tenant-oriented data model: club records are associated with memberships, isolated by Firestore Security Rules.
- English and French interface localization.
- Local persisted demo data, allowing the UI to run without network access or Firebase credentials.

## Architecture

```text
+------------------------+   Firebase Auth / Firestore SDK    +-------------------+
| SwiftUI iOS app        | <--------------------------------> | Firebase project  |
| ios-assodarts/         |                                     | Firestore + rules |
|                        | -------- Callable Function -------> | Cloud Functions   |
+------------------------+                                     +---------+---------+
                                                                          |
                                                                          | Stripe API / webhooks
                                                                          v
                                                                    +-----------+
                                                                    | Stripe    |
                                                                    | Connect   |
                                                                    +-----------+
```

| Area | Location | Responsibility |
| --- | --- | --- |
| App entry and session routing | `ios-assodarts/Assodarts/AssodartsApp.swift`, `ContentView.swift` | Starts the observable store, restores a session, registers push tokens, and routes to login, club, or developer UI. |
| Domain models | `ios-assodarts/Assodarts/Models/` | Swift models for clubs, members, events, tournaments, payments, conversations, and notifications. |
| State and demo mode | `ios-assodarts/Assodarts/Services/AppStore.swift`, `DemoData.swift` | Local persistence, optimistic UI mutations, demo seed data, and session state. |
| Firebase integration | `ios-assodarts/Assodarts/Services/Firebase/` | Native auth, Firestore repositories, mappings, push token persistence, and Cloud Function calls. |
| User interface | `ios-assodarts/Assodarts/Views/` | Authentication, club, messages, notifications, payments, profile, and developer screens. |
| Database contract | `backend/types.ts` | Hand-maintained TypeScript description of the Firestore document shapes. Keep in sync with `functions/src` and `RemoteModels.swift`. |
| Secure payment backend | `backend/functions/` | Firebase Cloud Functions (Node/TypeScript) for Stripe Connect, Checkout, return handling, webhooks, payment-state transitions, and notification/FCM fan-out. |

### Runtime modes

At launch, the app checks whether the Firebase configuration values were injected.

- **Demo mode:** one or more values are absent. `DemoData.seed()` supplies local data and the app remains usable offline.
- **Live mode:** all values are present. The app uses native Firebase Auth with email and password; the Firebase SDK owns refresh-token handling.

`Config.swift` is generated during the iOS build. Its checked-in values are intentionally empty, so credentials must never be committed there.

## Requirements

For local UI exploration:

- macOS with Xcode 26 or a compatible recent Xcode release.
- An iOS simulator or physical iOS device.
- Internet access on first open so Xcode can resolve Swift packages.

For the live backend and payments:

- A Firebase project (Blaze plan — Cloud Functions require it) with Firestore, Authentication (email/password), and Cloud Messaging enabled.
- Firebase CLI, authenticated against that project (`npm install -g firebase-tools`).
- Stripe account access with Connect enabled.
- A public HTTPS endpoint for Stripe webhooks (Cloud Functions provide this automatically once deployed).
- Apple Developer/APNs configuration when testing remote notifications on a physical device.

The app uses the [firebase-ios-sdk](https://github.com/firebase/firebase-ios-sdk) Swift package (Core, Auth, Firestore, Functions, Messaging), resolved by Xcode from the project file.

## Run the iOS app

1. Open `ios-assodarts/Assodarts.xcodeproj` in Xcode.
2. Select the `Assodarts` scheme and an iOS simulator or device.
3. Build and run with `Cmd+R`.
4. Without backend variables, use the supplied demo accounts shown by the login experience to explore the app.

From a macOS terminal, the equivalent simulator build command is:

```sh
xcodebuild \
  -project ios-assodarts/Assodarts.xcodeproj \
  -scheme Assodarts \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build
```

Adjust the destination to a simulator installed on the machine.

## Configure the live backend

### 1. Provision Firestore

This repository contains `backend/firestore.rules` and `backend/firestore.indexes.json` — deploy them to the linked Firebase project:

```sh
firebase login
firebase use --add                 # link the Firebase project, from backend/
firebase deploy --only firestore:rules,firestore:indexes
```

Firestore has no schema enforcement beyond these rules; `backend/types.ts` documents the expected document shape for every collection (`clubs`, `memberships`, `members`, `announcements`, `events`, `event_registrations`, `payment_calls`, `payment_call_items`, `club_bank_accounts`, `notifications`, `device_push_tokens`). Keep it in sync by hand with `backend/functions/src` and `RemoteModels.swift`.

### 2. Supply iOS public configuration

Provide these build-time values through the Rork/Xcode environment-injection mechanism that generates `ios-assodarts/Assodarts/Config.swift`, taken from the Firebase project's iOS app settings:

| Variable | Value |
| --- | --- |
| `FIREBASE_API_KEY` | iOS app API key |
| `FIREBASE_APP_ID` | iOS app ID (`1:...:ios:...`) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_GCM_SENDER_ID` | Sender ID (used by FCM) |
| `FIREBASE_STORAGE_BUCKET` | Default storage bucket |

These are public client identifiers, not secrets — but never put a Firebase Admin service-account key or the Stripe secret key into the app, project file, or source-controlled configuration.

### 3. Deploy Cloud Functions

```sh
cd backend/functions
npm install
cd ..
firebase deploy --only functions
```

### 4. Set Cloud Function secrets

```sh
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

| Secret | Used by | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | All Stripe functions | Server-side Stripe API access. |
| `STRIPE_WEBHOOK_SECRET` | `stripeWebhook` | Verifies the `Stripe-Signature` header. |

Do not include any of these values in Git, issue comments, or application logs.

### 5. Configure Stripe

1. Create or select the Stripe platform account that owns this integration.
2. Add a webhook endpoint: the deployed `stripeWebhook` function URL (`https://<region>-<project-id>.cloudfunctions.net/stripeWebhook`).
3. Subscribe it to `checkout.session.completed`, `charge.refunded`, and `account.updated`.
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Confirm the platform account and connected-account settings allow Express accounts, card payments, and transfers in each club's country.

The flow is intentionally server controlled: Checkout reloads the payment amount and ownership from Firestore, Stripe Connect routes payment proceeds to the club account, and only the verified webhook marks a payment line as paid.

## Cloud Functions

| Function | Type | Authentication | Description |
| --- | --- | --- | --- |
| `stripeConnectOnboard` | Callable | Firebase Auth + active board/admin membership | Creates or resumes an Express connected account and returns its short-lived onboarding URL. |
| `stripeConnectStatus` | Callable | Firebase Auth + active board/admin membership | Refreshes the connected account status in `club_bank_accounts`. |
| `stripeCreateCheckout` | Callable | Firebase Auth + ownership of the payment item | Creates a Stripe Checkout URL for one unpaid member payment line. |
| `stripeReturn` | HTTP | Public (browser redirect) | Returns an HTML completion, cancellation, or refresh response after hosted Stripe navigation. |
| `stripeWebhook` | HTTP | Stripe signature | Mirrors completed payments, refunds, and connected-account status into Firestore. |
| `declarePayment` / `validatePayment` / `cancelPaymentDeclaration` | Callable | Firebase Auth (+ board for validation) | Payment-state transitions, replacing the former Postgres RPCs. |
| `createInvitation` / `revokeInvitation` | Callable | Firebase Auth + active board/admin membership | Invites a member by email with a role, or withdraws a pending invitation. |
| `acceptInvitation` | Callable | Firebase Auth | Joins every club that invited the signed-in member's email; called automatically right after sign-in/sign-up. |
| `onPaymentItemWritten` / `onAnnouncementCreated` | Firestore trigger | Admin SDK only | Fan out `notifications` documents for board/member events. |
| `onNotificationCreated` | Firestore trigger | Admin SDK only | Sends the FCM push for every new notification. |

## Security model

- The iOS client only uses the public Firebase client configuration (API key, project ID, app ID) — never a service-account key.
- Firestore Security Rules (`backend/firestore.rules`) enforce tenant isolation and board-only writes for every collection the client touches directly.
- Money-moving state transitions (declare/validate/cancel a payment, anything Stripe, and notification creation) are **not** directly writable by clients — they only happen through Cloud Functions using the Admin SDK, which bypasses the rules the same way the callable/RPC split did before.
- Callable Cloud Functions re-check an active `admin` or `board` role from Firestore, never trusting a role claimed by the app.
- Checkout re-reads the payment amount, club, member, and paid status from Firestore before contacting Stripe.
- Webhook state changes require Stripe's signed request verification.
- Firestore Security Rules are a required part of the live deployment and must be kept under version control alongside the collections they protect.

## Testing and validation

Run the current test targets from Xcode with `Cmd+U`, or from a terminal:

```sh
xcodebuild test \
  -project ios-assodarts/Assodarts.xcodeproj \
  -scheme Assodarts \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

The committed unit-test target currently contains only Xcode's placeholder test. Add focused tests for permission checks, payment state transitions, repository mappings, and tenant boundaries before relying on a production backend.

For payment integration testing, use Stripe test keys and the Stripe CLI to forward events to the deployed webhook function, then confirm that an eligible `payment_call_items` document changes state only after a signed `checkout.session.completed` event.

Cloud Functions can be exercised locally with the Firebase emulator suite:

```sh
cd backend/functions && npm run build
cd .. && firebase emulators:start --only functions,firestore
```

## Repository layout

```text
.
├── rork.json                         # Rork application manifest
├── backend/
│   ├── types.ts                       # Hand-maintained Firestore document types
│   ├── firebase.json                  # Firebase project configuration
│   ├── firestore.rules                # Security rules (tenant isolation, roles)
│   ├── firestore.indexes.json         # Composite indexes
│   └── functions/                     # Firebase Cloud Functions (Node/TypeScript)
└── ios-assodarts/
    ├── Assodarts/                     # SwiftUI application source
    │   ├── Components/                # Reusable views
    │   ├── Models/                    # Domain types
    │   ├── Services/                  # App state, local data, remote integrations
    │   ├── Utilities/                 # Theme, formatting, localization
    │   └── Views/                     # Feature screens
    ├── Assodarts.xcodeproj/           # Xcode project and Swift package reference
    ├── AssodartsTests/                # Unit-test target
    └── AssodartsUITests/              # UI-test target
```

## Operational notes

- `Config.swift` is a generated, read-only bridge for build-time public variables. Keep the repository version empty.
- The local store uses `UserDefaults`; resetting demo data clears its persisted local application state.
- Build push notification capability, provisioning, and APNs-to-FCM bridging (already wired in `AssodartsApp.swift`) before expecting production push delivery.
- The backend directory has no separate migration tooling — Firestore has no schema to migrate, but `firestore.rules` and `firestore.indexes.json` must stay deployed and versioned alongside the collections they protect.
- Club invitations: the board invites a member by email (`InviteMemberSheet`), which creates an `invitations` document. `members.clubId` and the matching `memberships` document are only created once that email actually signs up or signs in — the app calls `acceptInvitation` automatically at that point. Until then, the invited row shown to the board is a local placeholder that disappears if the invite hasn't been accepted by the next refresh.

## License

No license file is currently included. Add one before distributing or accepting external contributions.
# Assodarts

Assodarts is an iOS app for running darts clubs. It gives club members a shared place for announcements, events, tournaments, messages, membership payments, and notifications. Club boards manage their own club data and can collect online payments through Stripe Connect.

The project is split into a native SwiftUI application and Supabase Edge Functions. It can be explored offline with seeded demo data; a configured Supabase project enables authentication and live club data.

## Features

### Members

- Sign in with email and password when the backend is configured.
- Browse club announcements, upcoming events, tournaments, and member details.
- RSVP to events, enter tournaments, and follow payment requests.
- Send direct messages or contact the club board.
- Receive local reminders and APNs device-token registration.
- Pay eligible payment lines with a hosted Stripe Checkout page.

### Club board

- Publish and pin announcements.
- Create events, tournaments, tournament entries, members, and payment calls.
- Record cash and transfer payments.
- Maintain bank details and payment methods for the club.
- Onboard the club to Stripe Connect and check its payment capability status.

### Platform

- A developer-only console for platform administration, broadcasts, and coupons.
- Tenant-oriented data model: club records are associated with memberships and the live backend relies on Supabase Row Level Security (RLS).
- English and French interface localization.
- Local persisted demo data, allowing the UI to run without network access or Supabase credentials.

## Architecture

```text
+------------------------+       Supabase Auth / PostgREST       +-------------------+
| SwiftUI iOS app        | <-----------------------------------> | Supabase project  |
| ios-assodarts/         |                                       | database + RLS    |
|                        | -------- Edge Function invocation --> | Edge Functions    |
+------------------------+                                       +---------+---------+
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
| Supabase integration | `ios-assodarts/Assodarts/Services/Supabase/` | Native auth, remote repositories, mappings, push token persistence, and Stripe Function calls. |
| User interface | `ios-assodarts/Assodarts/Views/` | Authentication, club, messages, notifications, payments, profile, and developer screens. |
| Database contract | `backend/types.ts` | Generated TypeScript representation of the expected Supabase schema. Do not edit it manually. |
| Secure payment backend | `backend/functions/` | Deno Edge Functions for Stripe Connect, Checkout, return handling, and webhooks. |

### Runtime modes

At launch, the app checks whether both public Supabase variables were injected.

- **Demo mode:** one or both variables are absent. `DemoData.seed()` supplies local data and the app remains usable offline.
- **Live mode:** both variables are present. The app uses native Supabase Auth with email and password; the Supabase SDK owns refresh-token handling.

`Config.swift` is generated during the iOS build. Its checked-in values are intentionally empty, so credentials must never be committed there.

> TODO avant de repasser ce repo en privé : migrer docs/index.html (politique de confidentialité, requise par Apple pour TestFlight/App Store) vers un repo public dédié, sinon GitHub Pages cessera de servir cette URL sur le plan Free.

## Requirements

For local UI exploration:

- macOS with Xcode 26 or a compatible recent Xcode release.
- An iOS simulator or physical iOS device.
- Internet access on first open so Xcode can resolve Swift packages.

For the live backend and payments:

- A Supabase project containing the schema represented by `backend/types.ts`.
- Supabase CLI, authenticated against that project.
- Stripe account access with Connect enabled.
- A public HTTPS endpoint for Stripe webhooks.
- Apple Developer/APNs configuration when testing remote notifications on a physical device.

The app uses the [supabase-swift](https://github.com/supabase/supabase-swift) Swift package, resolved by Xcode from the project file.

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

### 1. Provision the database

This repository contains the generated database contract but does **not** contain SQL migrations or `supabase/config.toml`. Create or link the intended Supabase project, apply the canonical schema and RLS policies from the project that generated `backend/types.ts`, then verify the required tables exist.

Important tables include `clubs`, `memberships`, `members`, `announcements`, `events`, `tournaments`, `payment_calls`, `payment_call_items`, `club_bank_accounts`, `chat_messages`, `notifications`, and subscription and billing tables.

Keep `backend/types.ts` synchronized with schema changes using the standard Supabase CLI type-generation workflow used by your team. It is generated code and should not be hand edited.

### 2. Supply iOS public configuration

Provide these build-time values through the Rork/Xcode environment-injection mechanism that generates `ios-assodarts/Assodarts/Config.swift`:

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL, for example `https://example.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

The anon key is intended for clients. Never put the service-role key or Stripe secret key into the app, project file, or source-controlled configuration.

### 3. Authenticate and deploy Edge Functions

Link the CLI to the live project, then deploy the functions:

```sh
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy stripe-connect-onboard
supabase functions deploy stripe-connect-status
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-return
supabase functions deploy stripe-webhook --no-verify-jwt
```

`stripe-webhook` deliberately accepts requests without a Supabase JWT because Stripe authenticates it with its signed webhook payload. Its signature check is mandatory.

### 4. Set Edge Function secrets

Set the following secrets in the linked Supabase project:

```sh
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_or_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_...
```

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The code uses the service-role key only server-side for administrative operations after authorization checks.

| Secret | Used by | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | All Stripe functions | Server-side Stripe API access. |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Verifies the `Stripe-Signature` header. |
| `SUPABASE_URL` | Shared auth and redirects | Supabase client construction and Function return URLs. |
| `SUPABASE_ANON_KEY` | Shared auth | Validates the caller's Supabase session while preserving RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Shared admin client | Server-side reads and writes requiring elevated access. |

Do not include any of these values in Git, issue comments, or application logs.

### 5. Configure Stripe

1. Create or select the Stripe platform account that owns this integration.
2. Add a webhook endpoint: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`.
3. Subscribe it to `checkout.session.completed`, `charge.refunded`, and `account.updated`.
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Confirm the platform account and connected-account settings allow Express accounts, card payments, and transfers in each club's country.

The flow is intentionally server controlled: Checkout reloads the payment amount and ownership from the database, Stripe Connect routes payment proceeds to the club account, and only the verified webhook marks a payment line as paid.

## Edge Functions

| Function | Authentication | Description |
| --- | --- | --- |
| `stripe-connect-onboard` | Supabase JWT + active board/admin membership | Creates or resumes an Express connected account and returns its short-lived onboarding URL. |
| `stripe-connect-status` | Supabase JWT + active board/admin membership | Refreshes the connected account status in `club_bank_accounts`. |
| `stripe-create-checkout` | Supabase JWT + ownership of the payment item | Creates a Stripe Checkout URL for one unpaid member payment line. |
| `stripe-return` | Browser redirect | Returns an HTML completion, cancellation, or refresh response after hosted Stripe navigation. |
| `stripe-webhook` | Stripe signature | Mirrors completed payments, refunds, and connected-account status into Supabase. |

## Security model

- The iOS client only uses the public Supabase URL and anon key.
- Edge Functions obtain the authenticated user from the bearer token; they do not trust a user ID sent by the app.
- Board-only Stripe operations re-check an active `admin` or `board` role in `memberships`.
- Checkout re-reads the payment amount, club, member, and paid status from the database before contacting Stripe.
- The service-role client is confined to server-side Edge Function code.
- Webhook state changes require Stripe's signed request verification.
- Database RLS policies are a required part of the live deployment and must be maintained alongside the schema.

## Testing and validation

Run the current test targets from Xcode with `Cmd+U`, or from a terminal:

```sh
xcodebuild test \
  -project ios-assodarts/Assodarts.xcodeproj \
  -scheme Assodarts \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

The committed unit-test target currently contains only Xcode's placeholder test. Add focused tests for permission checks, payment state transitions, repository mappings, and tenant boundaries before relying on a production backend.

For payment integration testing, use Stripe test keys and the Stripe CLI to forward events to the deployed webhook endpoint, then confirm that an eligible `payment_call_items` row changes state only after a signed `checkout.session.completed` event.

## Repository layout

```text
.
├── rork.json                         # Rork application manifest
├── backend/
│   ├── types.ts                       # Generated Supabase database types
│   └── functions/                     # Deno Supabase Edge Functions
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
- Build APNs capability, provisioning, and a backend device-token endpoint before expecting production push delivery.
- The backend directory lacks reproducible migrations in this checkout. Keep migrations and RLS policies under version control before treating this as an independently deployable production backend.

## License

No license file is currently included. Add one before distributing or accepting external contributions.
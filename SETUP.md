# Assodarts environment setup

## Environments

| Build configuration | Scheme      | Bundle identifier   | Firebase project    | Display name        |
| ------------------- | ----------- | ------------------- | ------------------- | ------------------- |
| `Debug`             | `Assodarts` | `com.assodarts.app` | `assodarts-staging` | `Assodarts Staging` |
| `Staging`           | `Staging`   | `com.assodarts.app` | `assodarts-staging` | `Assodarts Staging` |
| `Release`           | `Assodarts` | `com.assodarts.app` | `assodarts`         | `Assodarts`         |

`Debug` remains the local, simulator-friendly configuration. `Staging` is the
signed build distributed to pilot clubs. Because staging and production share
the same bundle identifier, they cannot be installed alongside each other on
one device. `Release` is reserved for production distribution.

The project uses `Config/Debug.xcconfig`, `Config/Staging.xcconfig`, and
`Config/Release.xcconfig` for environment-specific build values. Firebase
loads `GoogleService-Info.plist` from the app bundle when it is available; a
compile-time fallback in `Assodarts/Config.swift` keeps local builds usable
without credentials.

## Firebase plist placement

Never commit these files. Place each downloaded Firebase configuration here:

```text
ios-assodarts/Config/Firebase/Staging/GoogleService-Info.plist
ios-assodarts/Config/Firebase/Production/GoogleService-Info.plist
```

The Xcode build phase `Copy Firebase configuration` copies only the plist for
the active configuration into the app bundle. The staging workflow creates the
staging file from the GitHub Actions secret and removes it in an `always()`
cleanup step.

Download each plist from Firebase Console > Project settings > General > Your
apps. The iOS app bundle ID must be `com.assodarts.app` in both staging and
production. The Firebase project and plist remain environment-specific.

## Staging distribution

Pushes to the `staging` branch run the existing iOS/backend quality jobs and
SonarQube Quality Gate first. Only after those jobs pass does
`staging-distribute` archive and upload the IPA to Firebase App Distribution.
The backend deployment remains a separate manually triggered workflow.

The Firebase CLI aliases are maintained in `backend/.firebaserc`:
`staging` maps to `assodarts-staging`, and `production` maps to `assodarts`.

## GitHub Actions configuration

Configure `FIREBASE_PROJECT_ID` and `FIREBASE_IOS_APP_ID` as variables in the
GitHub `staging` environment. Configure the following secrets in that same
environment. The workflow uses no signing or service-account file from the
repository.

| Name                                       | Purpose                                                               | How to obtain it                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `APPLE_TEAM_ID`                            | Apple Developer team used for signing                                 | Apple Developer account > Membership details                                                                                        |
| `APPLE_CERTIFICATE_P12_BASE64`             | Base64 encoded iOS distribution certificate and private key           | Export the distribution certificate as `.p12` from Keychain Access, then run `base64 -i distribution.p12`                           |
| `APPLE_CERTIFICATE_PASSWORD`               | Password protecting the `.p12` file                                   | Password chosen during the Keychain export                                                                                          |
| `APPLE_PROVISIONING_PROFILE_BASE64`        | Base64 encoded App Store provisioning profile for `com.assodarts.app` | Create/download the profile in Apple Developer > Certificates, Identifiers & Profiles, then run `base64 -i profile.mobileprovision` |
| `GOOGLE_SERVICE_INFO_PLIST_STAGING_BASE64` | Staging Firebase iOS client configuration                             | Download the staging app plist from Firebase Console, then run `base64 -i GoogleService-Info.plist`                                 |
| `FIREBASE_SERVICE_ACCOUNT`                 | JSON credentials used by Firebase CLI/App Distribution                | Create a least-privilege service account key in Google Cloud IAM for `assodarts-staging`; store the complete JSON value             |
| `FIREBASE_TESTER_GROUP`                    | App Distribution tester group alias, for example `pilot-clubs`        | Firebase Console > App Distribution > Testers & Groups; use the exact group alias                                                   |

The workflow also requires these non-secret GitHub environment variables:

| Name                  | Value                                                            |
| --------------------- | ---------------------------------------------------------------- |
| `FIREBASE_PROJECT_ID` | `assodarts-staging`                                              |
| `FIREBASE_IOS_APP_ID` | The Firebase iOS App ID for the staging app, beginning with `1:` |

For base64 generation on macOS, do not add line wrapping; GitHub accepts the
single-line encoded value. Restrict the service account to the Firebase
App Distribution and deployment permissions it actually needs, and rotate
the key if it is ever exposed.

## Manual checklist

- [ ] Create/confirm the staging iOS app in Firebase with bundle ID `com.assodarts.app`.
- [ ] Confirm the production iOS app also uses `com.assodarts.app` in the production Firebase project.
- [ ] Download both Firebase plists and place them in the paths above locally; add only the staging plist as the CI secret.
- [ ] Register the shared bundle ID, distribution certificate, and App Store provisioning profile in Apple Developer.
- [ ] Enable automatic signing for the staging target/team in Xcode, or confirm the imported profile is valid for `com.assodarts.app`.
- [ ] Enable Firebase App Distribution and create the pilot-club tester group.
- [ ] Create the Firebase service account/key, grant the required staging-project permissions, and add it as `FIREBASE_SERVICE_ACCOUNT`.
- [ ] Add all GitHub `staging` environment variables and secrets listed above.
- [ ] Protect the `staging` branch and verify the first workflow run's IPA, shared bundle ID, Firebase project, and tester invitation.

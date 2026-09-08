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
loads `GoogleService-Info.plist` from the app bundle when it is available, and
falls back to the values `Assodarts/Config.swift` reads from
`FirebaseConfig.plist`. Neither file is committed: with no credentials the app
stays in local demo mode.

## Firebase plist placement

Never commit these files. Place each downloaded Firebase configuration here:

```text
ios-assodarts/Config/Firebase/Staging/GoogleService-Info.plist
ios-assodarts/Config/Firebase/Production/GoogleService-Info.plist
```

The fallback client identifiers used by `Config.swift` live next to them:

```text
ios-assodarts/Config/Firebase/Staging/FirebaseConfig.plist
ios-assodarts/Config/Firebase/Production/FirebaseConfig.plist
```

Generate them from environment variables:

```sh
cd ios-assodarts
FIREBASE_API_KEY_STAGING=... \
FIREBASE_APP_ID_STAGING=... \
FIREBASE_PROJECT_ID_STAGING=... \
FIREBASE_GCM_SENDER_ID_STAGING=... \
FIREBASE_STORAGE_BUCKET_STAGING=... \
  sh Config/generate-firebase-config.sh Staging
```

Use `Production` and the `*_PRODUCTION` variables for the production project.
Alternatively copy `Config/Firebase/FirebaseConfig.plist.example` into the
environment folder and fill it in by hand.

The Xcode build phase `Copy Firebase configuration` copies only the plists for
the active configuration into the app bundle. The staging workflow creates the
staging files from the Codemagic environment and removes it in an `always()`
cleanup step.

Download each plist from Firebase Console > Project settings > General > Your
apps. The iOS app bundle ID must be `com.assodarts.app` in both staging and
production. The Firebase project and plist remain environment-specific.

## Codemagic environment variables

Create these in app.codemagic.io > Environment variables, group `staging`.
Mark every one of them as secure. They feed
`Config/generate-firebase-config.sh` during the `ios-staging-distribute`
workflow, which is why no client identifier is committed anymore.

| Name                                       | Description                                                       | Where to find it                                                        |
| ------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `FIREBASE_API_KEY_STAGING`                 | Staging iOS API key (`AIza...`)                                   | Firebase Console > Project settings > General > Your apps > iOS         |
| `FIREBASE_APP_ID_STAGING`                  | Staging Firebase App ID (`1:...:ios:...`)                         | Same screen, field "App ID"                                             |
| `FIREBASE_PROJECT_ID_STAGING`              | `assodarts-staging`                                               | Same screen, field "Project ID"                                         |
| `FIREBASE_GCM_SENDER_ID_STAGING`           | Staging sender ID (project number)                                | Firebase Console > Project settings > Cloud Messaging                   |
| `FIREBASE_STORAGE_BUCKET_STAGING`          | `assodarts-staging.firebasestorage.app`                           | Firebase Console > Storage                                              |
| `GOOGLE_SERVICE_INFO_PLIST_STAGING_BASE64` | Staging `GoogleService-Info.plist`, base64 encoded (already used) | `base64 -i GoogleService-Info.plist`                                    |

A future production workflow needs the same five values in a `production`
group, named `FIREBASE_API_KEY_PRODUCTION`, `FIREBASE_APP_ID_PRODUCTION`,
`FIREBASE_PROJECT_ID_PRODUCTION`, `FIREBASE_GCM_SENDER_ID_PRODUCTION` and
`FIREBASE_STORAGE_BUCKET_PRODUCTION`, plus
`GOOGLE_SERVICE_INFO_PLIST_PRODUCTION_BASE64`. The build step is identical,
with `Production` as the script argument.

Regenerate the API keys in Google Cloud Console before entering them here if
they were ever committed, and restrict each key to the iOS bundle identifier.

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

## CodeQL security scanning

The repository is private and belongs to an individual GitHub account. Native
SARIF upload to the Security tab is therefore disabled with `upload: never`,
so the workflow does not require the GitHub Code Security/GHAS plan.

Each CodeQL job still runs the official analysis locally. It writes a complete
SARIF artifact and produces a severity summary in the GitHub Actions Job
Summary. Download one of these 30-day artifacts from the workflow run:

| Job     | Artifact               | File            |
| ------- | ---------------------- | --------------- |
| iOS     | `codeql-sarif-ios`     | `ios.sarif`     |
| Backend | `codeql-sarif-backend` | `backend.sarif` |

The SARIF file can be inspected with the VS Code **SARIF Viewer** extension or
the `sarif-web-component`. The local threshold fails a CodeQL job when an
`error` result is found; `warning` and `note` results are reported but do not
fail the job.

If the repository becomes public or GitHub Code Security is enabled, restore
native upload in both CodeQL steps by changing `upload: never` to
`upload: always` and adding `security-events: write` to the corresponding job
permissions. Keep the local artifact and summary steps so results remain
available for manual inspection.

## Platform admin bootstrap

The developer console is granted through the server-only `platform_admins`
collection. Resolve an existing Firebase Auth account and create the first
admin with:

```sh
node backend/scripts/grant-platform-admin.js \
	--project-id assodarts-staging \
	--email admin@assodarts.test
```

The command uses `GOOGLE_APPLICATION_CREDENTIALS` or Application Default
Credentials and refuses to overwrite an existing record unless `--force` is
provided. The staging seeder can also grant the optional account directly with
`--platform-admin-email`.

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

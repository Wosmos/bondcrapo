# Mobile app and releases

The Android app lives in `apps/mobile` (Expo SDK 58, Expo Router, React Native 0.88, Hermes, new architecture). It talks to the website's `/api/v1` through the typed `ApiClient` and zod contracts in `packages/shared`, so it never duplicates request or response types. Releases are built on GitHub Actions with `expo prebuild` and Gradle (no EAS) and are served to users by the website from the GitHub Release of this private repository (ADR 0006).

## What the app does

| Area | Details |
|---|---|
| Home | Next draws from the official schedule, latest results per denomination, wallet summary, update banner |
| Check | Many numbers and ranges at once (up to 1,000 per check), denomination filter, camera or photo scan with on-device ML Kit text recognition (`expo-text-extractor`), manual entry always available |
| Results | Every denomination, draw lists with "load older draws" paging, draw page with prize table, first and second prize numbers, paged third prize list, single number lookup, status and sources |
| My bonds | Anonymous wallet: create, restore with a sync code, add bonds (typed, pasted, ranges or scanned), remove, wins with "new" markers. Credentials live in `expo-secure-store` and are sent as `Authorization: Wallet <id>.<token>` |
| Rates | Pakistan gold and silver per tola and per 10 g with a Reported or Estimated label on every row, PKR open market and interbank rates, source attribution from the API |
| Settings | English or Urdu (right to left, the app restarts to flip the layout), light, dark or system theme, draw day reminders, win alerts, sync code, rotate or delete the wallet, check for updates |

Offline: every screen shows the last good response from local storage with a "showing the copy saved N minutes ago" notice when the network fails. Notifications are local only in v1: reminders are scheduled at 09:00 on draw days of owned denominations, and new wins are checked when the app opens and by a periodic `expo-background-task` job. Remote push needs Firebase and is deferred (ADR 0006).

Accessibility: every control has a role, label and state; touch targets are at least 44 dp; errors and results are announced through live regions; status is never conveyed by colour alone (icon plus text); bond numbers and prices always use Western digits in left to right order, also in Urdu; the colour tokens are contrast tested (`src/theme/__tests__/contrast.test.ts`). Urdu text uses Noto Nastaliq Urdu embedded at build time.

## Local development

```
source ~/.nvm/nvm.sh && nvm use 22 && corepack enable pnpm
pnpm install
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3105 pnpm --filter mobile start   # dev build or emulator
pnpm --filter mobile test        # Jest + React Native Testing Library
pnpm --filter mobile typecheck
pnpm --filter mobile lint
pnpm --filter mobile doctor      # expo-doctor
pnpm --filter mobile messages    # copy the website's shared message namespaces (common)
```

The camera scanner and secure storage need a development build (`pnpm --filter mobile android`, which runs `expo run:android` against a local Android SDK); Expo Go cannot load the ML Kit module. `http://` base URLs are accepted only in development builds.

`expo-doctor` is told (in `apps/mobile/package.json`, `expo.install.exclude`) not to compare `typescript`, `jest` and `@types/jest`: the monorepo pins TypeScript 5.9.3 for every package, and `jest-expo` 58 runs on Jest 30.

## Versions

`scripts/version.mjs` is the only way to change a version. The root `package.json` owns it; the script copies it into every workspace `package.json` and into `apps/mobile/app.json` (`expo.version`, and `expo.android.versionCode = major * 10000 + minor * 100 + patch`, so minor and patch stay below 100).

```
node scripts/version.mjs 1.2.0                 # write it everywhere
node scripts/version.mjs --check               # fail if any file disagrees
node scripts/version.mjs --check --tag v1.2.0  # what the release workflow runs
node scripts/version.mjs --json                # {"version":"1.2.0","versionCode":10200}
```

## Cutting a release

1. `node scripts/version.mjs x.y.z`, commit `chore(release): vx.y.z`.
2. `git tag -a vx.y.z -m "BondCheck x.y.z"` and push the commit and the tag.
3. `.github/workflows/mobile-release.yml` checks that the tag equals the version, runs the app's type check and tests, generates the Android project with `expo prebuild --platform android --no-install --clean`, runs `./gradlew assembleRelease`, and publishes a GitHub Release with three assets:
   - `bondcheck-x.y.z.apk` (or `bondcheck-x.y.z-unsigned.apk`)
   - `SHA256SUMS.txt`
   - `latest.json`: `version`, `versionCode`, `url` (relative, `/api/v1/releases/download/<apk>`), `sha256`, `size`, `minSupportedVersionCode`, `notes`, `publishedAt`
4. Within five minutes the website's `/download` page and the in-app update prompt show the new version.

Dry run: run the workflow manually (`workflow_dispatch`) with `dry_run` ticked. It builds an unsigned APK and uploads it, with the checksum and manifest, as the workflow artifact `android-release`; nothing is published. Pull requests that touch the app, `packages/shared`, the version script or the workflow run the same dry run, so a Gradle build is verified before merging.

Re-running the workflow for an existing tag replaces the assets of that release (`gh release upload --clobber`).

## Signing

The Expo config plugin `apps/mobile/plugins/with-release-signing.js` adds a `release` signing config to the generated `app/build.gradle` that reads `BONDCHECK_KEYSTORE_PATH`, `BONDCHECK_KEYSTORE_PASSWORD`, `BONDCHECK_KEY_ALIAS` and `BONDCHECK_KEY_PASSWORD` from the environment. Nothing secret is written to the project. Without a keystore the release build is left unsigned; it is never signed with the shared debug key.

Create the key once and keep two offline copies; Android only installs an update when it is signed with the same key, forever:

```
keytool -genkeypair -v -keystore bondcheck-release.keystore -alias bondcheck \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 bondcheck-release.keystore   # paste into the ANDROID_KEYSTORE_BASE64 secret
```

Repository secrets (Settings, Secrets and variables, Actions):

| Name | Purpose |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64 of the release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (for example `bondcheck`) |
| `ANDROID_KEY_PASSWORD` | Key password (defaults to the keystore password when empty) |

When the keystore secret is missing the workflow still publishes the release, but as a **prerelease** with an `-unsigned.apk` and a note saying so. GitHub's "latest release" ignores prereleases, so the website and the in-app updater never offer a file Android cannot install.

Repository variables:

| Name | Purpose |
|---|---|
| `BONDCHECK_SITE_URL` | Required for tag builds. The website origin baked into the app as `EXPO_PUBLIC_API_BASE_URL` (for example `https://bondcheck.pk`) |
| `BONDCHECK_MIN_SUPPORTED_VERSION_CODE` | Optional. Builds below this `versionCode` must update before they can be used (for example after a breaking API change). Defaults to 1 |

## How the website serves releases

The repository is private, so release assets are not public. The website calls the GitHub Releases API on the server with `GITHUB_RELEASES_TOKEN` (fine-grained, read-only Contents access to this repository only) and exposes its own routes. The token and GitHub URLs never reach the browser or the app.

| Route | Answer |
|---|---|
| `GET /api/v1/releases/latest` | The latest release (`releaseSchema`): version, notes, downloads with size, sha256 and relative download URLs. 404 `none` before the first release, 503 `unavailable` (`unconfigured` without a token). Cached 5 minutes |
| `GET /api/v1/releases/download/{asset}` | 302 to the short lived signed GitHub URL, only for plain file names that exist in the latest release. Binaries never stream through the website (Vercel limits response bodies to 4.5 MB). Signed URLs are reused for one minute per instance |
| `GET /api/v1/releases/updater` | The release's `latest.json` (`appManifestSchema`); 204 when there is nothing to update to |
| `GET /api/v1/app/latest` | The same manifest in the `{ data }` envelope; the app compares `versionCode` with the installed build |
| `/en/download`, `/ur/download` | Version, release date, size, SHA-256 with a copy button, install steps, QR code to the page (when `APP_BASE_URL` is set), release notes and other platform files if any are attached |

If `latest.json` is missing or points at a file that is not in the release, the website derives the manifest from the release itself (version from the tag, checksum from `SHA256SUMS.txt`). Desktop files attached to the same release are listed on `/download` by file type.

Website host environment (Vercel, never GitHub secrets): `GITHUB_RELEASES_TOKEN`, optionally `GITHUB_RELEASES_REPO` (default `Wosmos/bondcrapo`), and `APP_BASE_URL` for the QR code and canonical URLs.

## In-app updates

On start the app reads `GET /api/v1/app/latest`. A newer `versionCode` shows an update card on the home screen; a build older than `minSupportedVersionCode` opens a blocking update screen. The download button opens the website's download URL in the browser, but only when it points at the same host the app was built for. The screen shows the SHA-256 for people who want to verify the file. Over-the-air JavaScript updates (`expo-updates`) are not used in v1 (ADR 0006).

## Troubleshooting

- `version mismatch: tag ... does not match`: run `node scripts/version.mjs <tag version>`, commit, move the tag.
- `BONDCHECK_SITE_URL is not set`: add the repository variable; dry runs only warn.
- The download page says downloads are being set up: `GITHUB_RELEASES_TOKEN` is missing on the website host, or it expired (rotate it before its expiry date).
- The page says no version has been released: the newest release is a prerelease (an unsigned build) or there is no release yet.
- Gradle runs out of memory on the runner: `org.gradle.jvmargs` comes from the prebuild template (2 GB), which fits the standard GitHub runner.

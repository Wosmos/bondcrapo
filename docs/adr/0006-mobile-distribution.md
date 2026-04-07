# ADR 0006: Expo Android app built in GitHub Actions, distributed via the website

Status: accepted, 2026-10-15

## Context
The repo is private, so GitHub Release assets are not publicly downloadable. We want no EAS cloud dependency, and the owner's zcrypt repo uses tag-triggered release workflows (its `release.yml` is GoReleaser plus npm on `v*` tags; the same trigger, permissions and concurrency pattern is reused here).

## Decision
- `apps/mobile` is an Expo Router app using `packages/shared` contracts.
- On `v*` tags, `mobile-release.yml` runs `expo prebuild --platform android` and Gradle `assembleRelease` on the runner. If keystore secrets exist the APK is signed; otherwise an unsigned APK is produced and clearly labelled.
- The APK goes to the GitHub Release (canonical, private) and to a public Cloudflare R2 bucket with a `latest.json` manifest. The website `/download` page and `GET /api/v1/app/latest` read that manifest; the app compares `versionCode` and prompts to update.
- `scripts/version.mjs` is the single source of truth for versions across all packages and `app.json`; CI fails when the tag and version differ.
- No OTA (expo-updates) in v1: it needs an update server (EAS Update or a self-hosted protocol server) and adds risk; revisit after v1.
- Remote push is deferred (needs Firebase credentials); v1 uses local notifications for draw reminders and checks results on app open and via background tasks.

## Consequences
Users install from the website (sideload). A signing key must be kept stable forever once used, otherwise updates require uninstalling. Alternative to R2 if the owner prefers: a public `bondcheck-releases` repo receiving assets via a fine-grained token.

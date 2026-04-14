# ADR 0006: Expo Android app built in GitHub Actions, distributed through the website

Status: accepted, 2026-10-15. Amended: release assets are served from GitHub Releases through the website, not from Cloudflare R2.

## Context
The repo is private, so GitHub Release assets are not publicly downloadable. We want no EAS cloud dependency and no extra storage vendor. The owner's zcrypt repo uses tag-triggered release workflows (its `release.yml` is GoReleaser plus npm on `v*` tags; the same trigger, permissions and concurrency pattern is reused here). The owner's duolingo-clone project already solves the private-repo download problem: the website calls the GitHub Releases API server side with a fine-grained token and exposes its own `/api/releases/*` routes (`app/api/releases/latest`, `download/[asset]`, `updater`, documented in its `docs/RELEASING.md`). BondCheck reuses that pattern.

## Decision
- `apps/mobile` is an Expo Router app using `packages/shared` contracts.
- On `v*` tags, `mobile-release.yml` runs `expo prebuild --platform android` and Gradle `assembleRelease` on the runner. If keystore secrets exist the APK is signed; otherwise an unsigned APK is produced and clearly labelled.
- The APK, `SHA256SUMS.txt` and a `latest.json` manifest (`version`, `versionCode`, `url`, `sha256`, `minSupportedVersionCode`, `notes`) are attached to the GitHub Release of this private repo. That release is the only copy; there is no R2 bucket and no public mirror repo.
- The website serves the release through server-side routes using `GITHUB_RELEASES_TOKEN` (fine-grained, read-only Contents access to this repository only, set on the website host, never exposed to the client):
  - `GET /api/v1/releases/latest`: public view of the latest release (version, notes, assets with size and sha256). It never contains the token or a GitHub URL; download links are relative. Cached 5 minutes.
  - `GET /api/v1/releases/download/{asset}`: serves only asset names that exist in the latest release (strict name check) by answering `302` to the short lived signed URL GitHub returns, so binaries never stream through a function (Vercel Hobby limits response bodies to 4.5 MB).
  - `GET /api/v1/releases/updater`: the `latest.json` manifest; `GET /api/v1/app/latest` returns the same data for the app. The app compares `versionCode` and prompts to update.
  - Desktop artefacts, if they are ever built, are attached to the same release and listed by asset name.
  - If the token is missing the routes answer `unavailable` / `unconfigured`; `/download` shows a friendly message instead of failing.
- The website `/download` page reads the same lookup.
- `scripts/version.mjs` is the single source of truth for versions across all packages and `app.json`; CI fails when the tag and version differ.
- No OTA (expo-updates) in v1: it needs an update server (EAS Update or a self-hosted protocol server) and adds risk; revisit after v1.
- Remote push is deferred (needs Firebase credentials); v1 uses local notifications for draw reminders and checks results on app open and via background tasks.

## Consequences
Users install from the website (sideload). A signing key must be kept stable forever once used, otherwise updates require uninstalling. The website depends on the GitHub API being reachable and on the token staying valid (rotate it before expiry); results are cached so short outages are tolerated. Lane E owns `apps/web/src/app/api/v1/releases/**` and `apps/web/src/features/download/**`; M1 ships stubs that answer 501. Rejected: Cloudflare R2 public bucket (extra vendor and secrets), a public `bondcheck-releases` repo (a second repo to keep in sync).

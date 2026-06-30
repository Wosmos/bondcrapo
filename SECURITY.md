# Security policy

## Reporting a vulnerability

Please report security issues privately to the repository owner, Muhammad Wasif Malik, at m.wasifmalik17@gmail.com, with "BondCheck security" in the subject. Include the affected URL or file, steps to reproduce and the impact you expect. Do not open a public issue and do not test against other people's wallets or data.

You will get an acknowledgement within three working days and a status update at least every two weeks until the issue is resolved. Fixes ship in a patch release and are listed in `CHANGELOG.md` once users have had time to update.

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | Yes |
| Earlier builds | No |

## Security model

- **No accounts.** A wallet is a random id plus a 256-bit token held by the browser (an `httpOnly`, `SameSite=Lax`, `Secure` cookie) or the Android app (secure storage). The server stores only an HMAC-SHA256 of the token and of the sync code, keyed with `WALLET_PEPPER`, and compares them in constant time. Sync codes have 60 bits of entropy and are rotated when used.
- **Abuse limits.** Postgres-backed fixed window rate limits on the checker, wallet creation, restore (5 attempts per hour per client), writes and push subscriptions. Limit keys are keyed hashes of the client address, never the address itself. A hosting firewall is the outer layer.
- **Input validation.** Every route handler validates its body, query and parameters with the shared zod contracts; bond numbers are exactly six digits and ranges are capped at 1,000 numbers per check.
- **Cross-site requests.** State-changing wallet requests reject cross-site `Origin` and `Sec-Fetch-Site` values.
- **Scheduled jobs.** `/api/v1/cron/*` requires `Authorization: Bearer <CRON_SECRET>`, compared in constant time, and fails closed when the secret is not configured. There is no admin interface.
- **Headers.** Every response carries a Content-Security-Policy that allows this origin only (scanner workers and data are self-hosted), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` with `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` and `Cross-Origin-Opener-Policy: same-origin`. An end to end test checks them against the production server.
- **Privacy.** No fingerprinting, no IP or location storage, cookieless analytics (page views only). Bond numbers, tokens and sync codes are never logged. People can export and delete their wallet at any time.
- **Releases.** The Android APK is built in GitHub Actions, signed with a key held only in repository secrets, and published with SHA-256 checksums. The website serves it through short-lived signed URLs; the GitHub token never reaches clients.
- **Dependencies.** Every dependency is pinned to an exact version with a committed lockfile; CI runs `bun audit` and Dependabot reports known vulnerabilities.

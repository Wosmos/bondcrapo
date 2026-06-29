# ADR 0004: Anonymous wallets with sync codes instead of fingerprinting

Status: accepted, 2026-04-07

## Context
The current app identifies users by a browser fingerprint and logs IP, geolocation, battery level and more in an `events` table. That is fragile (fingerprints change), privacy-hostile, and does not work across devices or in the mobile app.

## Decision
- On first use the client calls `POST /api/v1/wallets` and receives a wallet id (UUIDv7), a 32-byte secret token, and a 12-character Crockford base32 sync code. The server stores only HMAC-SHA256 hashes (key `WALLET_PEPPER`).
- Web keeps the credential in an httpOnly, Secure, SameSite=Lax cookie; mobile keeps it in `expo-secure-store` and sends `Authorization: Wallet <id>.<token>`.
- A sync code restores the wallet on another device (new token issued, sync code rotated). Displayed as text and QR.
- Local-first: the bond list is also cached in IndexedDB (web) or SQLite/AsyncStorage (mobile) for offline viewing.
- Later sign-in (e.g. email magic link) links `wallets.userId` without changing wallet semantics.
- Fingerprinting, `devices` and `events` are removed.

## Consequences
Losing both the device and the sync code loses the wallet; the UI encourages saving the code. Restore endpoints are rate limited to make sync code guessing infeasible (60-bit codes, 5 attempts per hour per IP hash).

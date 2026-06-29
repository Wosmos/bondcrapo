# Contributing to BondCheck

BondCheck is one pnpm workspace: a Next.js web app, an Expo Android app and three shared packages. This guide covers the conventions every change follows. The architecture is in `docs/PLAN.md` and the decisions behind it in `docs/adr/`.

## Layout

| Path | What lives there |
|---|---|
| `apps/web` | Next.js 16 (App Router, next-intl `en` and `ur`). Source in `apps/web/src`. Vercel deploys from this directory. |
| `apps/mobile` | Expo app (Expo Router, Android first). See `docs/MOBILE_RELEASE.md`. |
| `packages/shared` | zod contracts for every `/api/v1` endpoint, `ApiClient`, units, bond number and wallet credential helpers. |
| `packages/db` | Drizzle schema, committed SQL migrations, query modules, PGlite test harness. |
| `packages/ingest` | `Fetcher`, `Job`, `runJob`, the CLI, parsers and recorded fixtures for prize bonds and markets. |
| `scripts/version.mjs` | The single source of truth for the release version. |

Inside `apps/web/src`: `app/` (routes), `features/<area>/` (bonds, markets, wallet, download), `components/` (shell and UI primitives), `i18n/`, `platform/` (hosting adapters), `server/` (cron dispatcher, database handle, HTTP helpers).

## Setup

```
source ~/.nvm/nvm.sh && nvm use 22 && corepack enable pnpm
pnpm install
cp apps/web/.env.example apps/web/.env.local     # optional; every variable is optional locally
pnpm dev                                          # http://localhost:3000 (PORT=3101 pnpm dev for another port)
```

## Checks

Every change must leave these green:

```
pnpm -r lint && pnpm -r typecheck && pnpm -r test && pnpm --filter web build
```

`pnpm --filter web build` must pass with no environment variables. End to end suites (Chromium, Pixel 7 emulation, axe in both locales):

```
pnpm --filter web build && pnpm --filter web e2e     # shell, accessibility, PWA, security headers (next start)
pnpm --filter web e2e:bonds                          # prize bond pages on recorded official documents
pnpm --filter web e2e:markets                        # market pages on a recorded snapshot
pnpm --filter web e2e:wallet                         # wallet flows on an in-memory database
```

Install the browser once with `pnpm --filter web exec playwright install chromium`.

## Rules

- **pnpm only**, every dependency pinned to an exact version (`save-exact=true` in `.npmrc`). Add a dependency to the package that uses it, never to the root, and commit the regenerated `pnpm-lock.yaml`.
- **Databases.** Never run migrations, `drizzle-kit push` or writes against the production Neon database. Tests use PGlite (`createTestDb()` from `@bondcheck/db/testing`) with the real migrations applied. Migrations are generated with `pnpm db:generate`, reviewed, committed under `packages/db/migrations` and applied by the owner (`docs/OWNER_SETUP.md`). Never edit an applied migration; add a new one with a `when` later than every journal entry.
- **Next.js 16.** Several APIs differ from older releases: `src/proxy.ts` replaces `middleware.ts`, `params` and `searchParams` are promises, `revalidateTag` takes a cache profile. Read the matching guide in `apps/web/node_modules/next/dist/docs/` before changing framework-level code.
- **Portability.** No `@vercel/*` import outside `apps/web/src/platform/`, no `export const runtime = "edge"`, cache tags only through `src/platform/revalidate.ts`. The app must keep building with OpenNext for Cloudflare (PLAN section 13).
- **Contracts and schema.** Request and response shapes live in `packages/shared/src/api`; route handlers validate input with them and tests parse every response with them. Change a contract together with both clients (web and mobile).
- **Static first.** Public pages are statically generated and revalidated by tag. Keep client components small islands; load heavy libraries (pdf.js, tesseract.js, xlsx, jspdf, zod contracts on the client) with dynamic `import()`. The initial JavaScript budget is checked by Lighthouse CI.
- **Client messages.** The root layout sends only the shell's messages to the browser. A client island that calls `useTranslations` is wrapped in `<ClientMessages locale={locale} paths={[...]}>` with just the message paths it uses.
- **RTL.** Tailwind logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`); the `bondcheck/logical-properties` lint rule rejects physical ones.
- **Theme.** Use the design tokens (`bg-surface`, `text-ink`, `border-line`, `text-danger`, ...) from `src/styles/globals.css`, never raw palette colours, so light and dark mode both pass contrast checks.
- **Numbers.** Bond numbers are six digits with Western digits in both locales, wrapped in `<bdi dir="ltr">`; use the formatters in `src/i18n/format.ts`.
- **Accessibility.** WCAG 2.2 AA: one `h1` per page, labelled fields, errors announced, targets at least 24 by 24 px, no colour-only meaning. Axe runs on every route in both locales in light and dark mode.
- **Privacy.** No fingerprinting, no IP or geolocation storage; rate limit keys are keyed hashes. Never log bond numbers, wallet tokens or sync codes.
- **Security.** The Content-Security-Policy (`apps/web/security-headers.ts`) allows this origin only. Self-host any new script, worker or data file instead of adding a host.
- **Commits.** Conventional commit messages (`feat(bonds): ...`, `fix(web): ...`). Docs use plain punctuation: no em dashes.
- **Licence.** The repository is private and proprietary (`LICENSE`, `"license": "UNLICENSED"` in every `package.json`).

## Environment

Server variables are validated lazily in `apps/web/src/platform/env.ts`; every one is optional and the feature that needs it degrades with a clear message. `apps/web/.env.example` lists them; local values go in `apps/web/.env.local`, which is gitignored.

## Releases

`node scripts/version.mjs <x.y.z>` writes the version into every `package.json` and the Expo config, `CHANGELOG.md` gets a section, and an annotated tag `v<x.y.z>` on that commit builds the Android release (`docs/MOBILE_RELEASE.md`).

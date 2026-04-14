# BondCheck monorepo guide

BondCheck is a Pakistan prize bond and markets product: a Next.js web app, an Expo Android app and shared packages, in one pnpm workspace. The plan is `docs/PLAN.md`; architecture decisions are `docs/adr/`; the state of the legacy data is `docs/DATA_AUDIT.md`. Lane work follows `docs/lanes/README.md`.

## Layout

- `apps/web`: Next.js 16 (App Router, next-intl `en` and `ur`). Source in `apps/web/src`. **Vercel deploys from `apps/web`** (the project's Root Directory must be `apps/web`; this is an owner setting, nothing in the repo changes it).
- `apps/mobile`: Expo app (created by the mobile lane).
- `packages/shared`: zod contracts for every `/api/v1` endpoint, `ApiClient`, units, bond number helpers, wallet credential helpers.
- `packages/db`: Drizzle schema, committed SQL migrations, PGlite test harness.
- `packages/ingest`: `Fetcher`, `Job`, `runJob`, CLI, parsers and fixtures.

## Commands (Node 22, pnpm via Corepack)

```
source ~/.nvm/nvm.sh && nvm use 22 && corepack enable pnpm
pnpm install
pnpm dev                      # apps/web on :3000 (PORT=3101 pnpm dev for another port)
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm db:generate              # drizzle-kit generate, writes SQL under packages/db/migrations
```

`pnpm build` must pass with no environment variables set.

## Rules

- pnpm only. Every dependency is pinned to an exact version (`save-exact=true` in `.npmrc`). No other lockfile.
- Never run migrations, `drizzle-kit push` or writes against the production Neon database. Tests use PGlite (`@bondcheck/db/testing`). The owner runs `pnpm db:migrate` after review.
- Next.js 16 differs from older releases (for example `proxy.ts` replaces `middleware.ts`, `revalidateTag` takes a profile). Read the relevant guide in `apps/web/node_modules/next/dist/docs/` before changing framework-level code.
- No `@vercel/*` import outside `apps/web/src/platform/`. No `export const runtime = "edge"`. Keep the code portable to Cloudflare (PLAN section 13).
- Contracts in `packages/shared/src/api/*` and the schema in `packages/db/src/schema/*` are frozen after M1; add new files in your own namespace instead of editing them.
- Tailwind logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`); the UI must work in RTL.
- Bond numbers are rendered as six digits with Western digits in both locales, wrapped in `<bdi dir="ltr">`.
- Privacy: no fingerprinting, no IP or geolocation storage, no raw IPs in rate limit keys.
- Docs: no em dashes. Conventional commit messages.
- The repository is private and the licence is proprietary (`LICENSE`, `"license": "UNLICENSED"`).

## Environment

Server variables are validated lazily in `apps/web/src/platform/env.ts` (names and owners in PLAN section 5.4). Local secrets live in `apps/web/.env.local` (gitignored). Release downloads use `GITHUB_RELEASES_TOKEN`, not a storage bucket (ADR 0006).

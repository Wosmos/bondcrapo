# Starting a lane

> Historical guide. The five workstreams below were built in parallel after the foundation milestone and merged into `master` for release 1.0.0 (June 2026). The `lane-*-requests.md` files record what each workstream asked of the integration: the code changes were applied in 1.0.0 and the owner actions moved to `docs/OWNER_SETUP.md`. For day to day work see `docs/DEVELOPMENT.md`.

Milestone M1 (foundation) is on `master`. Five lanes now run in parallel, each in its own git worktree and branch. Read `docs/PLAN.md` sections 2, 3, 6, 11, 13 and 14 and your lane's section first.

| Lane | Branch | Worktree directory | Web dev port | Milestones |
|---|---|---|---|---|
| A prize bonds | `lane-a-bonds` | `../bondcrapo-lane-a` | 3101 | A1, A2 |
| B markets | `lane-b-markets` | `../bondcrapo-lane-b` | 3102 | B1, B2 |
| C wallet | `lane-c-wallet` | `../bondcrapo-lane-c` | 3103 | C1, C2 |
| D shell, i18n, PWA | `lane-d-shell` | `../bondcrapo-lane-d` | 3104 | D1, D2 |
| E mobile and downloads | `lane-e-mobile` | `../bondcrapo-lane-e` | 3105 | E1, E2 |

## 1. Create the worktree

From the main checkout (`/home/wosmo/Documents/GitHub/bondcrapo`), on up-to-date `master`:

```
git worktree add ../bondcrapo-lane-a -b lane-a-bonds master
cd ../bondcrapo-lane-a
```

Swap the directory and branch for your lane. Do not commit to `master`; the integrator merges lanes in M-F.

## 2. Node and dependencies

```
source ~/.nvm/nvm.sh && nvm use 22
bun install --frozen-lockfile
```

Bun 1.3.12 is pinned by the `packageManager` field and CI. Add dependencies only to your own package or app, pinned exactly (`bun add --cwd <dir> <name>@<exact version>`, `bunfig.toml` makes exact the default). Do not hand edit `bun.lock`; the integrator regenerates it on merge.

## 3. Run the web app on your lane port

```
PORT=3101 bun run --cwd apps/web dev      # A=3101 B=3102 C=3103 D=3104 E=3105
```

The Expo app (lane E) uses Metro's own port; 3105 is the web `/download` page and API. Every unbuilt `/api/v1` endpoint answers `501 { error: { code: "not_implemented" } }`. `apps/web/.env.local` is gitignored and is not copied into worktrees; you do not need it. Never point development at the production Neon database for writes or migrations.

## 4. Test database: PGlite

All database tests use an in-memory PGlite with the real migrations applied.

```ts
import { createTestDb } from "@bondcheck/db/testing";
import { draws } from "@bondcheck/db/schema";

const t = await createTestDb();          // migrations applied, 10 denominations seeded
await t.db.insert(draws).values({ denominationCode: "750", drawDate: "2026-01-15", status: "published" });
await t.client.exec("select 1");         // raw SQL escape hatch
```

- `t.db` has the shared `Db` type (`@bondcheck/db`), so query modules written as `(db: Db, ...)` run on Neon HTTP in production and on PGlite in tests.
- Booting PGlite takes 10 to 20 seconds on this machine, so `createTestDb()` reuses one instance per test file and wipes it on every call. A later call invalidates earlier handles from the same file. Use `createTestDb({ fresh: true })` (and `await t.close()`) when two databases must exist at once.
- `createTestDb({ migrate: false, legacyShapes: true })` creates the pre-rebuild production tables for migration tests.
- Put `testTimeout: 120_000` and `hookTimeout: 120_000` in your package's `vitest.config.ts` (the existing packages already do). Create the test database once in `beforeAll`.
- Ingestion code gets its HTTP client from `Fetcher` (`@bondcheck/ingest`); inject a fake `fetch` and `sleep` in tests, never hit real sites from tests. `runJob` and `runJobToCompletion` record `ingestion_runs` and resume from the saved cursor.
- Route handler tests assert responses parse with the shared zod schema (`endpoint.response`).

## 5. What you own

Each lane edits only the paths listed in its section of PLAN.md section 14 (lane E also owns `apps/web/src/app/api/v1/releases/**` and `apps/web/src/features/download/**`). If you need a change in a file you do not own, write it in `docs/lanes/<lane>-requests.md` and stub around it; the integrator applies it in M-F.

Where things are:

- Route stubs: `apps/web/src/app/api/v1/**/route.ts` (replace the body, keep the exported method names; paths match the contracts).
- Contracts: `packages/shared/src/api/*`. Add `packages/shared/src/api/<lane>-extra.ts` for new shapes; the response must parse with the existing schemas.
- Schema: `packages/db/src/schema/*`. Add `packages/db/src/schema/<lane>-extra.ts` and a new migration `NNNN_<lane>_*.sql`; never edit `0000_foundation.sql`.
- Jobs: bonds and markets jobs go in `packages/ingest/src/{bonds,markets}/jobs.ts` (already imported by the CLI and the cron dispatcher); the wallet job goes in `apps/web/src/features/wallet/jobs.ts`. Job names are fixed by `CRON_JOBS` in `@bondcheck/shared`.
- Navigation: `apps/web/src/features/<area>/nav.ts`. Messages: `apps/web/messages/{en,ur}/<namespace>.json`, one namespace per lane.
- UI primitives: `apps/web/src/components/ui` (props are frozen; Lane D owns the internals).
- Platform adapters: `apps/web/src/platform/{analytics.tsx,revalidate.ts,waitUntil.ts,env.ts}`; locale routing is `apps/web/src/proxy.ts` and `apps/web/src/i18n/*`.
- Helpers: `uuidv7()`, `formatBondNumber`, wallet credential helpers and `RateLimiter` are in `@bondcheck/shared`; `errorResponse`, `jsonResponse` and `getDb()` are in `apps/web/src/server`.
- The old checker lives in `apps/web/src/legacy` and reads `legacy_winners` through `/api/legacy/*`; it is rendered by the temporary home page and is removed by the integrator.

## 6. Finish each milestone green

```
bun run --filter "*" lint && bun run --filter "*" typecheck && bun run --filter "*" test && bun run --cwd apps/web build
```

`bun run --cwd apps/web build` must pass with no environment variables. Commit with conventional messages (`feat(bonds): ...`). No em dashes in docs.

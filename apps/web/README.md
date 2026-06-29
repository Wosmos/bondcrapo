# apps/web

The BondCheck website and `/api/v1` (Next.js 16, App Router, next-intl `en` and `ur`). Part of the pnpm workspace; see the root `README.md`, `docs/CONTRIBUTING.md` and `docs/PLAN.md`.

```
pnpm --filter web dev        # http://localhost:3000, PORT=<n> to change
pnpm --filter web build      # passes with no environment variables
pnpm --filter web test       # Vitest (unit, contracts, PGlite integration)
pnpm --filter web e2e        # Playwright against next start (run the build first)
```

**Deployment:** Vercel deploys from this directory: the project's Root Directory must be `apps/web`. `vercel.json` holds the daily cron safety net (`/api/v1/cron/*`, authenticated with `CRON_SECRET`). Environment variables are listed in `.env.example` and `docs/OWNER_SETUP.md` and validated lazily in `src/platform/env.ts`. Security headers live in `security-headers.ts`; `open-next.config.ts` and `wrangler.jsonc` prepare the future Cloudflare build.

# apps/web

The BondCheck website and `/api/v1` (Next.js 16, App Router, next-intl `en` and `ur`). Part of the Bun workspace; see the root `README.md`, `docs/DEVELOPMENT.md` and `docs/PLAN.md`.

```
bun run --cwd apps/web dev        # http://localhost:3000, PORT=<n> to change
bun run --cwd apps/web build      # passes with no environment variables
bun run --cwd apps/web test       # Vitest (unit, contracts, PGlite integration)
bun run --cwd apps/web e2e        # Playwright against next start (run the build first)
```

**Deployment:** Vercel deploys from this directory: the project's Root Directory must be `apps/web`. `vercel.json` holds the daily cron safety net (`/api/v1/cron/*`, authenticated with `CRON_SECRET`). Environment variables are listed in `.env.example` and `docs/OWNER_SETUP.md` and validated lazily in `src/platform/env.ts`. Security headers live in `security-headers.ts`; `open-next.config.ts` and `wrangler.jsonc` prepare the future Cloudflare build.

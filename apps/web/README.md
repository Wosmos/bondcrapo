# apps/web

The BondCheck web app (Next.js 16, App Router, next-intl `en` and `ur`). Part of the pnpm workspace; see the root `CLAUDE.md` and `docs/PLAN.md`.

```
pnpm --filter web dev        # http://localhost:3000, PORT=<n> to change
pnpm --filter web build      # passes with no environment variables
pnpm --filter web test
```

**Deployment:** Vercel deploys from this directory. The Vercel project's Root Directory must be set to `apps/web`; `vercel.json` here holds the daily cron safety net (`/api/v1/cron/*`, authenticated with `CRON_SECRET`). Environment variables are listed in `docs/PLAN.md` section 5.4 and validated lazily in `src/platform/env.ts`.

---
description: Run the BondCheck Next.js app locally
---

# Run BondCheck locally

The active project is [bondcheck-next/](../../bondcheck-next/) — a Next.js 16 app on Neon Postgres.

## First-time setup

1. Install dependencies

```bash
cd bondcheck-next
bun install
```

2. Set env vars in `bondcheck-next/.env.local`

```
DATABASE_URL=postgres://...
CRON_SECRET=...
```

3. Push schema to Neon

```bash
cd bondcheck-next
bunx drizzle-kit push
```

## Start the dev server

// turbo

```bash
cd bondcheck-next
bun dev
```

## Access points

- App: http://localhost:3000
- Admin (dev only): http://localhost:3000/admin
- Health: http://localhost:3000/api/health

## Production build

```bash
cd bondcheck-next
bun run build
bun start
```

## Notes

- Cron jobs run on Vercel only — see [bondcheck-next/vercel.json](../../bondcheck-next/vercel.json)
- Drizzle Studio for browsing data: `bunx drizzle-kit studio`
- See [bondcheck-next/ROADMAP.md](../../bondcheck-next/ROADMAP.md) for product context

# BondCheck

> Halal financial literacy platform for Pakistan — prize bonds, gold/silver prices, currency rates, government commodities, Zakat, Islamic banking, and tax tools.

Built with Next.js 16, Drizzle ORM, and Neon Postgres. Hosted on Vercel.

See [ROADMAP.md](ROADMAP.md) for the full product vision, phases, and the **halal-only** principle that drives every feature decision.

## Quick start

```bash
bun install
bun dev
```

Open http://localhost:3000.

### Required env vars

```
DATABASE_URL=postgres://...     # Neon serverless Postgres
CRON_SECRET=...                 # Required for /api/cron/* auth
```

### Database

```bash
bunx drizzle-kit push           # Push schema to Neon
bunx drizzle-kit studio         # Browse data
```

## Scripts

| Command | What it does |
|---|---|
| `bun dev` | Start dev server (http://localhost:3000) |
| `bun run build` | Production build |
| `bun start` | Run production build |
| `bun run lint` | ESLint |

## Tech stack

- **Framework** Next.js 16.2 (App Router) + React 19.2
- **DB** Neon serverless Postgres + Drizzle ORM 0.45
- **Styling** Tailwind CSS 4
- **Data fetching** SWR 2.4
- **Tables** TanStack React Table 8
- **PDF / OCR** jsPDF, Tesseract.js, pdfjs-dist
- **Hosting** Vercel (cron jobs in [vercel.json](vercel.json))

## Layout

```
bondcheck-next/
├── app/                # App Router routes + API endpoints
│   ├── api/            # REST endpoints (search, draws, gold, forex, ...)
│   └── api/cron/       # Scheduled jobs (scrape, prices, daily-data)
├── components/         # React components (BondCheckApp + UI)
├── lib/                # DB client, schema, scrapers, utils
│   └── scrapers/       # External data sources (gold, forex, savings, ...)
├── hooks/              # React hooks
├── types/              # Shared TypeScript types
├── drizzle/            # Generated migrations
└── public/             # Static assets
```

Detailed file map and per-route purpose live in [ROADMAP.md](ROADMAP.md#codebase-structure).

## Working with AI agents

[AGENTS.md](AGENTS.md) flags the **Next.js 16 breaking changes** — agents should consult `node_modules/next/dist/docs/` before writing code. [CLAUDE.md](CLAUDE.md) defers to the same file.

## Deployment

Push to the `master` branch — Vercel auto-deploys. Vercel Pro is required for the multi-cron schedule in [vercel.json](vercel.json).

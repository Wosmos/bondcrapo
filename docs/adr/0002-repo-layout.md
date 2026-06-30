# ADR 0002: Bun workspace monorepo

Status: accepted, 2026-04-07

## Context
The repo holds a Next.js app (`bondcheck-next/`) plus legacy Python and vanilla JS apps being deleted. An Expo app is in scope, ingestion must run outside Next (CLI backfill, GitHub Actions, future Cloudflare Workers), and five implementers must work in parallel without editing the same files.

## Decision
Bun workspace: `apps/web` (Next.js), `apps/mobile` (Expo), `packages/shared` (zod contracts, API client, domain math), `packages/db` (Drizzle schema, migrations, queries), `packages/ingest` (jobs and parsers). Node 22, Bun, exact pins. No Turborepo initially; root scripts use `pnpm -r`.

Rejected: single app at the repo root (mobile would duplicate types; ingestion tied to Next); separate repos (contract drift, harder releases); Nx or Turborepo (extra tooling before it pays off).

## Consequences
Vercel Root Directory becomes `apps/web`. Expo needs Metro configured for workspaces (supported by default in recent SDKs with Bun's isolated linker, which keeps the web app on React 19.2 and the app on React 19.3). Lanes own disjoint directories.

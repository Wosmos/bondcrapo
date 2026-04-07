# ADR 0002: pnpm workspace monorepo

Status: accepted, 2026-10-15

## Context
The repo holds a Next.js app (`bondcheck-next/`) plus legacy Python and vanilla JS apps being deleted. An Expo app is in scope, ingestion must run outside Next (CLI backfill, GitHub Actions, future Cloudflare Workers), and five implementers must work in parallel without editing the same files.

## Decision
pnpm workspace: `apps/web` (Next.js), `apps/mobile` (Expo), `packages/shared` (zod contracts, API client, domain math), `packages/db` (Drizzle schema, migrations, queries), `packages/ingest` (jobs and parsers). Node 22, pnpm via Corepack, exact pins. No Turborepo initially; root scripts use `pnpm -r`.

Rejected: single app at the repo root (mobile would duplicate types; ingestion tied to Next); separate repos (contract drift, harder releases); Nx or Turborepo (extra tooling before it pays off).

## Consequences
Vercel Root Directory becomes `apps/web`. Expo needs Metro configured for workspaces (supported by default in recent SDKs with pnpm `node-linker=hoisted` in `apps/mobile` if required). Lanes own disjoint directories.

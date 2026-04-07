# ADR 0003: Scheduler-agnostic cron via authenticated HTTP endpoints

Status: accepted, 2026-10-15

## Context
Vercel Hobby crons run at most once a day with hour-level precision (https://vercel.com/docs/cron-jobs/manage-cron-jobs). Draw results appear on specific days and markets need intraday updates. We will move to Cloudflare later.

## Decision
Every job is a pure function `runJob(name, trigger, cursor)` in shared server code, exposed as `GET|POST /api/v1/cron/{job}` protected by `Authorization: Bearer CRON_SECRET` (constant-time compare, fail closed). Jobs are chunked (under 45 s per call) and resumable through `ingestion_runs.cursor`. Triggers:
- GitHub Actions `schedule` for frequency (draw days every 2 h, markets every 30 min on weekdays).
- Vercel Cron once a day per job as a safety net.
- Later: Cloudflare Cron Triggers calling the same function from a `scheduled()` handler.
- Backfills run as a CLI from `workflow_dispatch` or locally.

## Consequences
No dependence on any single scheduler; duplicate triggers are harmless because jobs are idempotent. GitHub Actions schedules can be delayed by several minutes, acceptable for this domain.

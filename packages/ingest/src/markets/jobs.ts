import type { Job } from "../job";

/**
 * Lane B registers `metals-spot`, `fx-daily`, `pk-market`, `local-rates-derive` and
 * `housekeeping` here. The web cron dispatcher (apps/web/src/features/markets/jobs.ts) imports this list.
 */
export const marketJobs: Job[] = [];

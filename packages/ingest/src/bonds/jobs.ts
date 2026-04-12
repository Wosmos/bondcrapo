import type { Job } from "../job";

/**
 * Lane A registers `bonds-sync`, `bonds-verify` and `bonds-schedule` here. The web cron
 * dispatcher (apps/web/src/features/bonds/jobs.ts) imports this list.
 */
export const bondJobs: Job[] = [];

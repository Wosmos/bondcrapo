import type { JobMap } from "@bondcheck/ingest";
import { bondsJobs } from "@/features/bonds/jobs";
import { marketsJobs } from "@/features/markets/jobs";
import { walletJobs } from "@/features/wallet/jobs";

/**
 * Job registry behind /api/v1/cron/{job}. Names come from CRON_JOBS in @bondcheck/shared.
 * Each lane contributes through its own `features/<area>/jobs.ts`.
 */
export const jobs: JobMap = { ...bondsJobs, ...marketsJobs, ...walletJobs };

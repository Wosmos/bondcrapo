import { jobMap } from "@bondcheck/ingest";
import { marketJobs } from "@bondcheck/ingest/markets/jobs";

/** Lane B: implement the jobs in packages/ingest/src/markets/jobs.ts, nothing to change here. */
export const marketsJobs = jobMap(marketJobs);

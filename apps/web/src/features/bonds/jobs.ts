import { jobMap } from "@bondcheck/ingest";
import { bondJobs } from "@bondcheck/ingest/bonds/jobs";

/** Lane A: implement the jobs in packages/ingest/src/bonds/jobs.ts, nothing to change here. */
export const bondsJobs = jobMap(bondJobs);

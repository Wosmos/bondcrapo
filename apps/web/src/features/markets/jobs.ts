import { jobMap, type Job } from "@bondcheck/ingest";
import { marketJobs } from "@bondcheck/ingest/markets/jobs";
import { MARKETS_TAG, revalidateTags } from "@/platform/revalidate";

/**
 * Lane B cron jobs. After a run that stored anything, the `markets` cache tag is revalidated so
 * the ISR market pages pick up the new numbers (PLAN section 7).
 */
export function withMarketsRevalidation(job: Job, revalidate: (tags: readonly string[]) => void = revalidateTags): Job {
  return {
    name: job.name,
    async run(ctx, cursor) {
      const result = await job.run(ctx, cursor);
      if (job.name !== "housekeeping") {
        try {
          revalidate([MARKETS_TAG]);
        } catch (error) {
          // Outside a request scope (CLI) there is nothing to revalidate.
          await ctx.issue({ severity: "info", entity: "revalidate", entityKey: MARKETS_TAG, message: String(error) });
        }
      }
      return result;
    },
  };
}

export const marketsJobs = jobMap(marketJobs.map((j) => withMarketsRevalidation(j)));

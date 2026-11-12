import { jobMap, type Job } from "@bondcheck/ingest";
import { marketJobs } from "@bondcheck/ingest/markets/jobs";
import { MARKETS_TAG, revalidateTags } from "@/platform/revalidate";

/**
 * Lane B cron jobs. After a run, the market pages that job feeds are rebuilt so they pick up the
 * new numbers (PLAN section 7). Every rebuild is an ISR write of every visited page in the section,
 * so the spot price, which arrives every 30 minutes, does not rebuild pages: they refresh on their
 * own timer instead.
 */
const JOB_TAGS: Record<string, readonly string[]> = {
  "metals-spot": [],
  housekeeping: [],
  "local-rates-derive": ["markets:gold"],
  "fx-daily": ["markets:fx"],
};

export function withMarketsRevalidation(job: Job, revalidate: (tags: readonly string[]) => void = revalidateTags): Job {
  const tags = JOB_TAGS[job.name] ?? [MARKETS_TAG];
  return {
    name: job.name,
    async run(ctx, cursor) {
      const result = await job.run(ctx, cursor);
      if (tags.length) {
        try {
          revalidate(tags);
        } catch (error) {
          // Outside a request scope (CLI) there is nothing to revalidate.
          await ctx.issue({ severity: "info", entity: "revalidate", entityKey: tags.join(","), message: String(error) });
        }
      }
      return result;
    },
  };
}

export const marketsJobs = jobMap(marketJobs.map((j) => withMarketsRevalidation(j)));

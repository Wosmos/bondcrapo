import { Fetcher, jobMap, runJob, type Job, type JobContext } from "@bondcheck/ingest";
import { bondJobs } from "@bondcheck/ingest/bonds/jobs";
import { bondTags, revalidateTags } from "@/platform/revalidate";
import { walletJobs } from "@/features/wallet/jobs";

interface Committed {
  drawId: number;
  denominationCode: string;
  completeness: string;
}

/**
 * After a bond job commits draws: revalidate the cached pages and API data of those draws
 * (tags `bonds`, `bonds:<code>`, `draw:<id>`), then, when new results arrived, run the wallet
 * matcher right away (PLAN section 5.3: wallet-notify is chained after bonds-sync commits).
 */
async function afterCommit(ctx: JobContext, committed: Committed[]): Promise<Record<string, unknown>> {
  if (!committed.length) return {};
  const tags = new Set<string>();
  for (const c of committed) for (const t of bondTags(c.denominationCode, c.drawId)) tags.add(t);
  try {
    revalidateTags([...tags]);
  } catch {
    // Outside a request scope (CLI, tests) there is no cache to revalidate.
  }
  const notify = walletJobs["wallet-notify"];
  if (!notify || !committed.some((c) => c.completeness !== "none")) return { revalidated: tags.size };
  const chained = await runJob(notify, { db: ctx.db, fetcher: new Fetcher({ userAgent: ctx.fetcher.userAgent }), trigger: ctx.trigger });
  return { revalidated: tags.size, walletNotify: { runId: chained.runId, status: chained.status } };
}

function withRevalidation(job: Job): Job {
  return {
    name: job.name,
    async run(ctx, cursor) {
      const result = await job.run(ctx, cursor);
      const committed = Array.isArray(result.stats.committed) ? (result.stats.committed as Committed[]) : [];
      return { ...result, stats: { ...result.stats, committed: committed.length, ...(await afterCommit(ctx, committed)) } };
    },
  };
}

/** The bond jobs live in packages/ingest/src/bonds/jobs.ts; this adds cache revalidation. */
export const bondsJobs = jobMap(bondJobs.map(withRevalidation));

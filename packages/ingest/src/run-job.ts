import { and, desc, eq } from "drizzle-orm";
import { ingestionIssues, ingestionRuns, type Db } from "@bondcheck/db";
import { uuidv7 } from "@bondcheck/shared";
import type { Fetcher } from "./fetcher";
import type { Job, JobContext, JobTrigger } from "./job";

export interface RunJobOptions {
  db: Db;
  fetcher: Fetcher;
  trigger: JobTrigger;
  /** Wall clock budget per invocation. Default 45 s (Vercel Hobby allows 60 s). */
  budgetMs?: number;
  now?: () => Date;
}

export interface RunJobResult {
  runId: string;
  status: "running" | "ok" | "partial" | "failed";
  done: boolean;
  stats: Record<string, unknown>;
}

/**
 * Runs one chunk of a job with `ingestion_runs` bookkeeping. If the previous run of this job
 * stopped early (status `partial` with a cursor) the work resumes from that cursor.
 */
export async function runJob(job: Job, options: RunJobOptions): Promise<RunJobResult> {
  const { db, fetcher, trigger } = options;
  const now = options.now ?? (() => new Date());
  const budgetMs = options.budgetMs ?? 45_000;
  const started = now();

  const [previous] = await db
    .select({ status: ingestionRuns.status, cursor: ingestionRuns.cursor })
    .from(ingestionRuns)
    .where(eq(ingestionRuns.job, job.name))
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(1);
  const resumeFrom = previous?.status === "partial" && previous.cursor != null ? previous.cursor : null;

  const runId = uuidv7(started.getTime());
  await db.insert(ingestionRuns).values({
    id: runId,
    job: job.name,
    trigger,
    startedAt: started,
    status: "running",
    cursor: resumeFrom,
  });

  const ctx: JobContext = {
    db,
    fetcher,
    trigger,
    runId,
    now,
    shouldStop: () => now().getTime() - started.getTime() >= budgetMs,
    issue: async (input) => {
      await db.insert(ingestionIssues).values({
        runId,
        severity: input.severity,
        entity: input.entity,
        entityKey: input.entityKey,
        message: input.message,
        details: input.details ?? null,
      });
    },
  };

  try {
    const result = await job.run(ctx, resumeFrom);
    const status = result.done ? (result.status ?? "ok") : "partial";
    await db
      .update(ingestionRuns)
      .set({
        finishedAt: now(),
        status,
        cursor: result.done ? null : (result.cursor ?? null),
        stats: result.stats,
      })
      .where(and(eq(ingestionRuns.id, runId)));
    return { runId, status, done: result.done, stats: result.stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(ingestionRuns)
      .set({ finishedAt: now(), status: "failed", error: message, cursor: resumeFrom })
      .where(eq(ingestionRuns.id, runId));
    return { runId, status: "failed", done: true, stats: { error: message } };
  }
}

/** Calls `runJob` until the job reports `done` (CLI and backfill use this). */
export async function runJobToCompletion(
  job: Job,
  options: RunJobOptions & { maxChunks?: number },
): Promise<RunJobResult[]> {
  const results: RunJobResult[] = [];
  for (let i = 0; i < (options.maxChunks ?? 10_000); i++) {
    const r = await runJob(job, options);
    results.push(r);
    if (r.done || r.status === "failed") break;
  }
  return results;
}

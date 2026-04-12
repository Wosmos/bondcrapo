import type { Db } from "@bondcheck/db";
import type { Fetcher } from "./fetcher";

export type JobTrigger = "vercel-cron" | "gha" | "cli" | "cf-cron" | "manual";
export type IssueSeverity = "info" | "warn" | "error";

export interface JobContext {
  db: Db;
  fetcher: Fetcher;
  trigger: JobTrigger;
  runId: string;
  now(): Date;
  /** True once the time budget is spent: finish the current item, return `{ done: false, cursor }`. */
  shouldStop(): boolean;
  /** Records a row in `ingestion_issues`. Failures create issues; invalid data never reaches published tables. */
  issue(input: {
    severity: IssueSeverity;
    entity: string;
    entityKey: string;
    message: string;
    details?: unknown;
  }): Promise<void>;
}

export interface JobResult {
  /** false: more work remains, call again and the saved `cursor` is passed back. */
  done: boolean;
  cursor: unknown;
  stats: Record<string, unknown>;
  /** Set to "partial" when the run finished but degraded (e.g. a fallback provider was used). */
  status?: "ok" | "partial";
}

/** One ingestion job: `discover -> fetch -> parse -> validate -> reconcile -> commit -> report`. */
export interface Job {
  name: string;
  run(ctx: JobContext, cursor: unknown): Promise<JobResult>;
}

export type JobMap = Partial<Record<string, Job>>;

export function jobMap(jobs: readonly Job[]): JobMap {
  return Object.fromEntries(jobs.map((j) => [j.name, j]));
}

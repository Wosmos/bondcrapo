import { Fetcher, runJob, type JobMap, type JobTrigger, type RunJobResult } from "@bondcheck/ingest";
import { CRON_JOBS, type CronJobName } from "@bondcheck/shared";
import { getDb } from "./db";
import { jobs as registry } from "./jobs";

export class UnknownJobError extends Error {}
export class JobNotImplementedError extends Error {}

export const isCronJobName = (value: string): value is CronJobName =>
  (CRON_JOBS as readonly string[]).includes(value);

const USER_AGENT = `BondCheckBot/1.0 (+${process.env.APP_BASE_URL ?? "https://bondcheck.invalid"}/about/data)`;

/**
 * Runs one chunk of a job. The route handler wraps this, and the Cloudflare `scheduled()`
 * handler can call it directly (PLAN section 13).
 */
export async function runCronJob(
  name: string,
  trigger: JobTrigger,
  jobs: JobMap = registry,
): Promise<RunJobResult> {
  if (!isCronJobName(name)) throw new UnknownJobError(name);
  const job = jobs[name];
  if (!job) throw new JobNotImplementedError(name);
  return runJob(job, { db: getDb(), fetcher: new Fetcher({ userAgent: USER_AGENT }), trigger });
}

import type { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/server/http";
import { isCronAuthorized } from "@/server/cron-auth";
import {
  JobNotImplementedError,
  UnknownJobError,
  isCronJobName,
  runCronJob,
} from "@/server/cron";
import type { JobTrigger } from "@bondcheck/ingest";

// Never cached: every call runs (or resumes) a job.
export const dynamic = "force-dynamic";

async function handle(request: NextRequest, params: Promise<{ job: string }>): Promise<Response> {
  // Auth first, before the job name is looked at, so unknown names cannot be probed anonymously.
  if (!(await isCronAuthorized(request.headers.get("authorization")))) {
    return errorResponse("unauthorized", "missing or invalid cron credentials");
  }
  const { job } = await params;
  if (!isCronJobName(job)) return errorResponse("not_found", `unknown job: ${job}`);

  // Vercel Cron issues GET and identifies itself; GitHub Actions and others POST.
  const trigger: JobTrigger =
    request.method === "GET" && request.headers.get("user-agent")?.startsWith("vercel-cron")
      ? "vercel-cron"
      : request.headers.get("x-trigger") === "gha"
        ? "gha"
        : "manual";
  try {
    return jsonResponse(await runCronJob(job, trigger));
  } catch (error) {
    if (error instanceof JobNotImplementedError) {
      return errorResponse("not_implemented", `${job} is not implemented yet`);
    }
    if (error instanceof UnknownJobError) return errorResponse("not_found", `unknown job: ${job}`);
    return errorResponse("internal", error instanceof Error ? error.message : "job failed");
  }
}

export const GET = (request: NextRequest, ctx: { params: Promise<{ job: string }> }) =>
  handle(request, ctx.params);
export const POST = GET;

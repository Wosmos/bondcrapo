import { z } from "zod";
import { CRON_JOBS } from "../constants";
import { isoDateTimeSchema } from "./common";
import { defineEndpoint } from "./endpoint";

export const cronJobSchema = z.enum(CRON_JOBS);

export const cronResultSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(["running", "ok", "partial", "failed"]),
  /** false means the job stopped at its time budget: call again to continue from the cursor. */
  done: z.boolean(),
  stats: z.record(z.string(), z.unknown()),
});
export type CronResult = z.infer<typeof cronResultSchema>;

const cronParams = z.object({ job: cronJobSchema });

export const cronGet = defineEndpoint({
  id: "cron.get",
  method: "GET",
  path: "/cron/{job}",
  auth: "cron",
  params: cronParams,
  response: cronResultSchema,
});

export const cronPost = defineEndpoint({
  id: "cron.post",
  method: "POST",
  path: "/cron/{job}",
  auth: "cron",
  params: cronParams,
  response: cronResultSchema,
});

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["ok", "unreachable", "unconfigured"]),
  lastRuns: z.record(z.string(), z.object({ status: z.string(), finishedAt: isoDateTimeSchema.nullable() })),
  freshness: z.object({ latestDrawDate: z.string().nullable(), latestMetalObservedAt: isoDateTimeSchema.nullable() }),
});

export const getHealth = defineEndpoint({
  id: "ops.health",
  method: "GET",
  path: "/health",
  auth: "none",
  response: healthSchema,
});

/** Mobile update manifest (same shape as the `latest.json` asset attached to each GitHub Release). */
export const appManifestSchema = z.object({
  version: z.string(),
  versionCode: z.number().int(),
  url: z.string(),
  sha256: z.string(),
  size: z.number().int().nullable(),
  minSupportedVersionCode: z.number().int(),
  notes: z.string(),
  publishedAt: isoDateTimeSchema.nullable(),
});
export type AppManifest = z.infer<typeof appManifestSchema>;

export const getAppLatest = defineEndpoint({
  id: "app.latest",
  method: "GET",
  path: "/app/latest",
  auth: "none",
  response: appManifestSchema,
});

export const releaseAssetSchema = z.object({
  name: z.string(),
  platform: z.enum(["android", "windows", "macos", "linux", "other"]),
  size: z.number().int(),
  sha256: z.string().nullable(),
  /** Always a relative `/api/v1/releases/download/<name>` URL; GitHub URLs are never exposed. */
  url: z.string(),
});

/** The latest GitHub Release as served by the website (private repo, server side token). */
export const releaseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    version: z.string(),
    name: z.string(),
    publishedAt: isoDateTimeSchema.nullable(),
    notes: z.string(),
    downloads: z.array(releaseAssetSchema),
  }),
  z.object({ status: z.literal("none") }),
  z.object({ status: z.literal("unavailable"), reason: z.enum(["unconfigured", "error"]) }),
]);

export const getReleasesLatest = defineEndpoint({
  id: "releases.latest",
  method: "GET",
  path: "/releases/latest",
  auth: "none",
  response: releaseSchema,
  raw: true,
});

/** Redirects (302) to a short lived signed asset URL; only assets of the latest release are served. */
export const getReleaseDownload = defineEndpoint({
  id: "releases.download",
  method: "GET",
  path: "/releases/download/{asset}",
  auth: "none",
  params: z.object({ asset: z.string().min(1).max(200) }),
  response: z.never(),
  raw: true,
});

export const getReleasesUpdater = defineEndpoint({
  id: "releases.updater",
  method: "GET",
  path: "/releases/updater",
  auth: "none",
  response: appManifestSchema,
  raw: true,
});

export const appEndpoints = {
  cronGet,
  cronPost,
  getHealth,
  getAppLatest,
  getReleasesLatest,
  getReleaseDownload,
  getReleasesUpdater,
} as const;

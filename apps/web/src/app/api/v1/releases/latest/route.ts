import { publicRelease, rawJson, RELEASE_CACHE, RELEASE_FAILURE_CACHE } from "@/features/download/responses";
import { releaseSource } from "@/features/download/releases";

/** GET /api/v1/releases/latest: the latest release as `releaseSchema` (raw JSON, not enveloped). */
export async function GET() {
  const lookup = await releaseSource().latest();
  const body = publicRelease(lookup);
  if (lookup.status === "ok") return rawJson(body, 200, RELEASE_CACHE);
  return rawJson(body, lookup.status === "none" ? 404 : 503, RELEASE_FAILURE_CACHE);
}

import { NextResponse } from "next/server";
import { rawJson, RELEASE_CACHE } from "@/features/download/responses";
import { releaseSource } from "@/features/download/releases";
import { errorResponse } from "@/server/http";

/**
 * GET /api/v1/releases/updater: the `latest.json` manifest of the latest release (raw JSON,
 * `appManifestSchema`). 204 means there is nothing to update to.
 */
export async function GET() {
  const lookup = await releaseSource().latest();
  if (lookup.status === "unavailable") return errorResponse("unavailable", "The update service is unavailable right now.");
  if (lookup.status === "none" || !lookup.release.manifest) {
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "public, s-maxage=60" } });
  }
  return rawJson(lookup.release.manifest, 200, RELEASE_CACHE);
}

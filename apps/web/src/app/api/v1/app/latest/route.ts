import { releaseSource, RELEASE_REVALIDATE_SECONDS } from "@/features/download/releases";
import { errorResponse, jsonResponse } from "@/server/http";

/** GET /api/v1/app/latest: the mobile update manifest in the `{ data }` envelope (same source as /releases/updater). */
export async function GET() {
  const lookup = await releaseSource().latest();
  if (lookup.status === "unavailable") return errorResponse("unavailable", "The update service is unavailable right now.");
  if (lookup.status === "none" || !lookup.release.manifest) return errorResponse("not_found", "No app release has been published yet.");
  return jsonResponse(lookup.release.manifest, {
    cache: { sMaxAge: RELEASE_REVALIDATE_SECONDS, staleWhileRevalidate: 3600 },
  });
}

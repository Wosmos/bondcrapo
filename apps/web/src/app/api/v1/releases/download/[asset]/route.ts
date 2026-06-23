import { NextResponse } from "next/server";
import { getReleaseDownload } from "@bondcheck/shared";
import { SAFE_ASSET_NAME } from "@/features/download/release-assets";
import { cachedAssetUrl, releaseSource } from "@/features/download/releases";
import { errorResponse } from "@/server/http";

/**
 * GET /api/v1/releases/download/{asset}: 302 to the short lived signed GitHub URL. Only plain
 * file names that exist in the latest release are served; binaries never pass through here.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ asset: string }> }) {
  // The contract declares the params schema; validate against it before anything else.
  const parsed = getReleaseDownload.params!.safeParse(await params);
  if (!parsed.success || !SAFE_ASSET_NAME.test(parsed.data.asset)) {
    return errorResponse("not_found", "No such download.");
  }
  const source = releaseSource();
  const lookup = await source.latest();
  if (lookup.status === "none") return errorResponse("not_found", "No release has been published yet.");
  if (lookup.status !== "ok") return errorResponse("unavailable", "Downloads are unavailable right now. Please try again shortly.");

  const asset = lookup.release.assets.find((a) => a.name === parsed.data.asset);
  if (!asset) return errorResponse("not_found", "No such download.");

  const location = await cachedAssetUrl(source, asset.id);
  if (!location) return errorResponse("unavailable", "The download could not be started. Please try again shortly.");
  return NextResponse.redirect(location, { status: 302, headers: { "Cache-Control": "no-store" } });
}

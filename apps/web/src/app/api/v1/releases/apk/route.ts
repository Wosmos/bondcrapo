import { NextResponse } from "next/server";
import { classifyAsset } from "@/features/download/release-assets";
import { cachedAssetUrl, releaseSource } from "@/features/download/releases";

/**
 * GET /api/v1/releases/apk: starts the Android download straight away (302 to the short lived
 * signed GitHub URL). This is what the download page's QR code encodes, so scanning it saves the
 * file instead of opening a page. When no release is published or GitHub cannot be reached it
 * sends the visitor to the download page, which explains what is going on, rather than showing a
 * bare error.
 */
export async function GET(req: Request) {
  const fallback = NextResponse.redirect(new URL("/en/download", req.url), { status: 302, headers: { "Cache-Control": "no-store" } });
  try {
    const source = releaseSource();
    const lookup = await source.latest();
    if (lookup.status !== "ok") return fallback;
    const asset = lookup.release.assets.find((a) => classifyAsset(a.name) === "android");
    if (!asset) return fallback;
    const location = await cachedAssetUrl(source, asset.id);
    if (!location) return fallback;
    return NextResponse.redirect(location, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch {
    return fallback;
  }
}

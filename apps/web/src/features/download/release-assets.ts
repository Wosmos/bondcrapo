/**
 * Pure helpers that turn a GitHub Release into what the website serves (no network, no
 * secrets), following the owner's release proxy pattern (ADR 0006).
 */
import { appManifestSchema, type AppManifest, type releaseAssetSchema } from "@bondcheck/shared";
import type { z } from "zod";

export type ReleaseAsset = z.infer<typeof releaseAssetSchema>;
export type Platform = ReleaseAsset["platform"];

export interface RawAsset {
  id: number;
  name: string;
  size: number;
}

export const DOWNLOAD_PATH = "/api/v1/releases/download/";
export const MANIFEST_ASSET = "latest.json";
export const CHECKSUMS_ASSET = "SHA256SUMS.txt";

/** Asset names we are willing to serve: plain file names, nothing path like or hidden. */
export const SAFE_ASSET_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,199}$/;

export function downloadUrl(name: string): string {
  return `${DOWNLOAD_PATH}${encodeURIComponent(name)}`;
}

/** Installable files only; manifests, checksums and signatures are not offered as downloads. */
export function classifyAsset(name: string): Platform | null {
  const n = name.toLowerCase();
  if (n.endsWith(".sig") || n.endsWith(".json") || n.endsWith(".txt") || n.endsWith(".md")) return null;
  if (n.endsWith(".apk")) return "android";
  if (n.endsWith(".exe") || n.endsWith(".msi")) return "windows";
  if (n.endsWith(".dmg") || n.endsWith(".pkg")) return "macos";
  if (n.endsWith(".appimage") || n.endsWith(".deb") || n.endsWith(".rpm")) return "linux";
  return null;
}

/** Parses `sha256sum` output: "<hex>  <name>" per line. */
export function parseChecksums(text: string): Record<string, string> {
  const sums: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^([a-f0-9]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (m) sums[m[2]!.trim()] = m[1]!.toLowerCase();
  }
  return sums;
}

export function publicDownloads(assets: readonly RawAsset[], sums: Record<string, string>): ReleaseAsset[] {
  const order: Platform[] = ["android", "windows", "macos", "linux", "other"];
  return assets
    .filter((a) => SAFE_ASSET_NAME.test(a.name))
    .flatMap((a) => {
      const platform = classifyAsset(a.name);
      return platform ? [{ name: a.name, platform, size: a.size, sha256: sums[a.name] ?? null, url: downloadUrl(a.name) }] : [];
    })
    .sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform) || a.name.localeCompare(b.name));
}

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** Same formula as scripts/version.mjs: major * 10000 + minor * 100 + patch. */
export function versionCodeFor(version: string): number | null {
  const m = SEMVER.exec(version);
  if (!m) return null;
  const [major, minor, patch] = m.slice(1).map(Number) as [number, number, number];
  if (minor > 99 || patch > 99) return null;
  return major * 10000 + minor * 100 + patch;
}

/**
 * The app manifest for a release. Uses the attached `latest.json` when it is valid and points
 * at an asset of this release; otherwise derives one from the release itself (version from the
 * tag, checksum from SHA256SUMS.txt). Returns null when the release has no Android APK.
 */
export function buildManifest(input: {
  version: string;
  publishedAt: string | null;
  notes: string;
  assets: readonly RawAsset[];
  sums: Record<string, string>;
  manifestText: string | null;
}): AppManifest | null {
  const byName = new Map(input.assets.map((a) => [a.name, a]));
  const apk = publicDownloads(input.assets, input.sums).find((d) => d.platform === "android");

  if (input.manifestText) {
    try {
      const parsed = appManifestSchema.safeParse(JSON.parse(input.manifestText));
      if (parsed.success) {
        const file = decodeURIComponent(parsed.data.url.split("/").pop() ?? "");
        const asset = SAFE_ASSET_NAME.test(file) ? byName.get(file) : undefined;
        if (asset) {
          return {
            ...parsed.data,
            url: downloadUrl(asset.name),
            size: parsed.data.size ?? asset.size,
            sha256: (input.sums[asset.name] ?? parsed.data.sha256).toLowerCase(),
            publishedAt: parsed.data.publishedAt ?? input.publishedAt,
          };
        }
      }
    } catch {
      // Fall through to the derived manifest.
    }
  }

  if (!apk) return null;
  const versionCode = versionCodeFor(input.version);
  if (versionCode === null || !apk.sha256) return null;
  return {
    version: input.version,
    versionCode,
    url: apk.url,
    sha256: apk.sha256,
    size: apk.size,
    minSupportedVersionCode: 1,
    notes: input.notes.slice(0, 4000),
    publishedAt: input.publishedAt,
  };
}

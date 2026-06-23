import "server-only";
import type { AppManifest } from "@bondcheck/shared";
import { serverEnv } from "@/platform/env";
import {
  buildManifest,
  CHECKSUMS_ASSET,
  MANIFEST_ASSET,
  parseChecksums,
  publicDownloads,
  type RawAsset,
  type ReleaseAsset,
} from "./release-assets";

/**
 * Reads the latest GitHub Release of this private repository server side. Every call carries
 * GITHUB_RELEASES_TOKEN (fine-grained, read-only Contents on this repo); the token never leaves
 * this module and no GitHub URL is ever returned to clients (ADR 0006).
 */

export const RELEASE_REVALIDATE_SECONDS = 300;
const API = "https://api.github.com";

export interface LatestRelease {
  version: string;
  tag: string;
  name: string;
  publishedAt: string | null;
  notes: string;
  downloads: ReleaseAsset[];
  /** Every asset in the release (validates download requests). */
  assets: RawAsset[];
  manifest: AppManifest | null;
}

export type ReleaseLookup =
  | { status: "ok"; release: LatestRelease }
  | { status: "none" }
  | { status: "unavailable"; reason: "unconfigured" | "error" };

export interface ReleaseSourceOptions {
  token?: string;
  repo: string;
  fetch?: typeof fetch;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft?: boolean;
  prerelease?: boolean;
  published_at: string | null;
  assets: { id: number; name: string; size: number; state?: string }[];
}

type NextFetchInit = RequestInit & { next?: { revalidate?: number; tags?: string[] } };

export function createReleaseSource({ token, repo, fetch: doFetch = globalThis.fetch }: ReleaseSourceOptions) {
  const headers = (accept = "application/vnd.github+json"): Record<string, string> => ({
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "bondcheck-release-proxy",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const get = (url: string, init: NextFetchInit) => doFetch(url, init as RequestInit);

  async function assetText(assetId: number): Promise<string | null> {
    const res = await get(`${API}/repos/${repo}/releases/assets/${assetId}`, {
      headers: headers("application/octet-stream"),
      next: { revalidate: RELEASE_REVALIDATE_SECONDS, tags: ["releases"] },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 256_000 ? null : text;
  }

  async function latest(): Promise<ReleaseLookup> {
    if (!token) return { status: "unavailable", reason: "unconfigured" };
    try {
      const res = await get(`${API}/repos/${repo}/releases/latest`, {
        headers: headers(),
        next: { revalidate: RELEASE_REVALIDATE_SECONDS, tags: ["releases"] },
      });
      if (res.status === 404) return { status: "none" };
      if (!res.ok) return { status: "unavailable", reason: "error" };
      const data = (await res.json()) as GitHubRelease;
      if (data.draft || data.prerelease) return { status: "none" };

      const assets: RawAsset[] = data.assets
        .filter((a) => a.state === undefined || a.state === "uploaded")
        .map(({ id, name, size }) => ({ id, name, size }));
      const find = (name: string) => assets.find((a) => a.name === name);
      const [sumsText, manifestText] = await Promise.all([
        find(CHECKSUMS_ASSET) ? assetText(find(CHECKSUMS_ASSET)!.id) : Promise.resolve(null),
        find(MANIFEST_ASSET) ? assetText(find(MANIFEST_ASSET)!.id) : Promise.resolve(null),
      ]);
      const sums = sumsText ? parseChecksums(sumsText) : {};
      const version = data.tag_name.replace(/^v/, "");
      const notes = data.body ?? "";
      return {
        status: "ok",
        release: {
          version,
          tag: data.tag_name,
          name: data.name || `BondCheck ${version}`,
          publishedAt: data.published_at,
          notes,
          downloads: publicDownloads(assets, sums),
          assets,
          manifest: buildManifest({ version, publishedAt: data.published_at, notes, assets, sums, manifestText }),
        },
      };
    } catch {
      return { status: "unavailable", reason: "error" };
    }
  }

  /** The short lived signed URL GitHub redirects to, so binaries never stream through us. */
  async function assetUrl(assetId: number): Promise<string | null> {
    try {
      const res = await get(`${API}/repos/${repo}/releases/assets/${assetId}`, {
        headers: headers("application/octet-stream"),
        redirect: "manual",
        cache: "no-store",
      });
      if (res.status < 300 || res.status >= 400) return null;
      const location = res.headers.get("location");
      return location && location.startsWith("https://") ? location : null;
    } catch {
      return null;
    }
  }

  return { latest, assetUrl };
}

export type ReleaseSource = ReturnType<typeof createReleaseSource>;

let override: ReleaseSource | null = null;

/** Test hook: swap the source used by the route handlers and the download page. */
export function setReleaseSource(source: ReleaseSource | null): void {
  override = source;
}

export function releaseSource(): ReleaseSource {
  if (override) return override;
  const env = serverEnv();
  return createReleaseSource({ token: env.GITHUB_RELEASES_TOKEN, repo: env.GITHUB_RELEASES_REPO });
}

const signedUrlCache = new Map<number, { url: string; expires: number }>();
const SIGNED_URL_TTL_MS = 60_000;

/**
 * Signed URLs stay valid for a few minutes, so a warm instance reuses one for a minute. This keeps
 * bursts of downloads from spending the token's API quota (the CDN and firewall sit in front).
 */
export async function cachedAssetUrl(source: ReleaseSource, assetId: number, now = Date.now()): Promise<string | null> {
  const hit = signedUrlCache.get(assetId);
  if (hit && hit.expires > now) return hit.url;
  const url = await source.assetUrl(assetId);
  if (url) {
    if (signedUrlCache.size > 50) signedUrlCache.clear();
    signedUrlCache.set(assetId, { url, expires: now + SIGNED_URL_TTL_MS });
  }
  return url;
}

export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

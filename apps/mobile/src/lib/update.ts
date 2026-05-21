import type { AppManifest } from "@bondcheck/shared";

export type UpdateState =
  | { kind: "current" }
  | { kind: "optional"; manifest: AppManifest }
  | { kind: "required"; manifest: AppManifest };

/**
 * Compares the installed build with the release manifest. `required` means the installed build
 * is older than `minSupportedVersionCode` (for example after an API change) and the app should
 * not be used until it is updated.
 */
export function evaluateUpdate(installedVersionCode: number | null, manifest: AppManifest): UpdateState {
  if (installedVersionCode === null || !Number.isFinite(installedVersionCode)) return { kind: "current" };
  if (manifest.versionCode <= installedVersionCode) return { kind: "current" };
  if (installedVersionCode < manifest.minSupportedVersionCode) return { kind: "required", manifest };
  return { kind: "optional", manifest };
}

/** Only https download links on the configured site are opened (never an arbitrary scheme). */
export function isTrustedDownloadUrl(url: string, apiBaseUrl: string | null): boolean {
  if (!apiBaseUrl) return false;
  try {
    const target = new URL(url, apiBaseUrl);
    const base = new URL(apiBaseUrl);
    const secure = target.protocol === "https:" || (__DEV__ && target.protocol === "http:");
    return secure && target.host === base.host;
  } catch {
    return false;
  }
}

/** Resolves the manifest URL (relative or absolute) against the site. */
export function resolveDownloadUrl(url: string, apiBaseUrl: string): string {
  return new URL(url, apiBaseUrl).toString();
}

import Constants from "expo-constants";
import * as Application from "expo-application";

/**
 * Website origin serving /api/v1. Set at build time with EXPO_PUBLIC_API_BASE_URL (the release
 * workflow passes the repository variable BONDCHECK_SITE_URL); `extra.apiBaseUrl` in app config
 * is a fallback for local builds.
 */
export function apiBaseUrl(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const fromConfig = (Constants.expoConfig?.extra as { apiBaseUrl?: unknown } | undefined)?.apiBaseUrl;
  const candidate = typeof fromEnv === "string" && fromEnv ? fromEnv : typeof fromConfig === "string" ? fromConfig : "";
  return normaliseBaseUrl(candidate);
}

export function normaliseBaseUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(__DEV__ && url.protocol === "http:")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function appVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "0.0.0";
}

/** Android versionCode of the installed build (null in Expo Go or tests). */
export function installedVersionCode(): number | null {
  const raw = Application.nativeBuildVersion;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

import "server-only";
import { z } from "zod";

/**
 * Server environment, validated lazily (never at import time) so `next build` passes with no
 * variables set. Each lane calls `requireEnv` for the keys it needs at request time.
 * Names and owners are listed in PLAN section 5.4. Nothing here is ever sent to the client.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  APP_BASE_URL: z.string().url().optional(),
  WALLET_PEPPER: z.string().min(32).optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  METALS_FALLBACK_API_KEY: z.string().min(1).optional(),
  /** Fine-grained, read-only Contents token for this private repo (release proxy, Lane E). */
  GITHUB_RELEASES_TOKEN: z.string().min(1).optional(),
  /** "owner/repo" holding the GitHub Releases that /api/v1/releases/* serves. */
  GITHUB_RELEASES_REPO: z.string().regex(/^[\w.-]+\/[\w.-]+$/).default("Wosmos/bondcrapo"),
  ANALYTICS_PROVIDER: z.enum(["vercel", "none"]).default("vercel"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}

/** Returns a variable that a feature cannot work without, or throws a clear error. */
export function requireEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = serverEnv()[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable ${String(key)}`);
  }
  return value as NonNullable<ServerEnv[K]>;
}

/** Test helper. */
export function resetServerEnvCache(): void {
  cached = undefined;
}

import "server-only";
import { z } from "zod";

/** An unset variable and an empty one mean the same thing (hosting dashboards often save ""). */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

/**
 * Server environment, validated lazily (never at import time) so `next build` passes with no
 * variables set. Every variable is optional: each feature degrades with a clear 503 or a hidden
 * control when its variables are missing. `.env.example` and docs/OWNER_SETUP.md list them all.
 * Nothing here is ever sent to the client.
 */
const serverEnvSchema = z.object({
  // Core
  /** Neon pooled connection string. Without it every data endpoint answers 503. */
  DATABASE_URL: optional(z.string().min(1)),
  /** Production origin, for canonical URLs, hreflang, sitemaps, Open Graph and the crawler UA. */
  APP_BASE_URL: optional(z.url()),
  /** Bearer secret for /api/v1/cron/*. The endpoint fails closed when it is unset. */
  CRON_SECRET: optional(z.string().min(16)),
  /** HMAC key for rate limit subjects (32+ chars). Falls back to WALLET_PEPPER, then CRON_SECRET. */
  RATE_LIMIT_SECRET: optional(z.string().min(32)),

  // Wallet (anonymous identity, ADR 0004)
  /** HMAC key for wallet tokens and sync codes. Set once, never rotate. Wallets answer 503 without it. */
  WALLET_PEPPER: optional(z.string().min(32)),
  /** Web Push keys (base64url) and contact. Without them wins are recorded but not pushed. */
  VAPID_PUBLIC_KEY: optional(z.string().min(1)),
  VAPID_PRIVATE_KEY: optional(z.string().min(1)),
  VAPID_SUBJECT: optional(z.string().regex(/^(mailto:|https:)/)),

  // Markets
  /** MetalpriceAPI key for the metals fallback provider. */
  METALS_FALLBACK_API_KEY: optional(z.string().min(1)),
  /** "1" once the FreeGoldAPI licence is confirmed: enables monthly gold history before 2024. */
  MARKETS_ALLOW_FREEGOLDAPI: optional(z.enum(["1"])),

  // Releases (ADR 0006)
  /** Fine-grained, read-only Contents token for this private repo (release proxy). */
  GITHUB_RELEASES_TOKEN: optional(z.string().min(1)),
  /** "owner/repo" holding the GitHub Releases that /api/v1/releases/* serves. */
  GITHUB_RELEASES_REPO: optional(z.string().regex(/^[\w.-]+\/[\w.-]+$/)).transform((v) => v ?? "Wosmos/bondcrapo"),

  // Platform
  ANALYTICS_PROVIDER: optional(z.enum(["vercel", "none"])).transform((v) => v ?? "vercel"),

  // Development and end-to-end tests only (ignored when NODE_ENV is production)
  /** "fixtures" serves the recorded official bond documents without a database. */
  BONDS_DATA: optional(z.enum(["fixtures"])),
  /** JSON snapshot served by the market pages instead of the database. */
  MARKETS_FIXTURE_FILE: optional(z.string().min(1)),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

function parse(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))].join(", ");
  throw new Error(`Invalid environment variable(s): ${names}. See .env.example.`);
}

/** Cached in production; re-read in development and tests so env changes apply. */
export function serverEnv(): ServerEnv {
  if (process.env.NODE_ENV !== "production") return parse();
  cached ??= parse();
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

/**
 * Secret for the keyed hashes in `rate_limits` keys (no raw addresses are ever stored).
 * One variable for every limiter; null when the server has no secret at all.
 */
export function rateLimitSecret(): string | null {
  const env = serverEnv();
  return env.RATE_LIMIT_SECRET ?? env.WALLET_PEPPER ?? env.CRON_SECRET ?? null;
}

/** Test helper. */
export function resetServerEnvCache(): void {
  cached = undefined;
}

import "server-only";
import { hitRateLimit } from "@bondcheck/db/queries/markets";
import type { RateLimitResult, RateLimitRule, RateLimiter } from "@bondcheck/shared";
import type { Db } from "@bondcheck/db";

/** Public market reads: generous, the CDN absorbs most traffic (s-maxage). */
export const MARKETS_READ_RULE: RateLimitRule = { name: "markets-read", limit: 120, windowSeconds: 60 };

/** Fixed window limiter on the `rate_limits` table. `subject` is already an opaque hash. */
export class PgRateLimiter implements RateLimiter {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async hit(rule: RateLimitRule, subject: string): Promise<RateLimitResult> {
    const nowMs = this.now().getTime();
    const windowMs = rule.windowSeconds * 1000;
    const start = Math.floor(nowMs / windowMs) * windowMs;
    const count = await hitRateLimit(this.db, `${rule.name}:${subject}`, new Date(start));
    const retryAfterSeconds = Math.max(1, Math.ceil((start + windowMs - nowMs) / 1000));
    return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), retryAfterSeconds };
  }
}

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | undefined;
let keySecret: string | undefined;

/**
 * Opaque client subject: HMAC-SHA256 of the client address under a server secret, truncated.
 * The raw address is never stored (repository privacy rule). Returns null when no secret is
 * configured; the caller then skips limiting instead of storing a guessable hash.
 */
export async function clientSubject(request: Request, secret = process.env.RATE_LIMIT_PEPPER ?? process.env.CRON_SECRET): Promise<string | null> {
  if (!secret) return null;
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!keyPromise || keySecret !== secret) {
    keySecret = secret;
    keyPromise = crypto.subtle.importKey("raw", encoder.encode(`markets-rate-limit:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await keyPromise, encoder.encode(ip)));
  return Array.from(mac.subarray(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

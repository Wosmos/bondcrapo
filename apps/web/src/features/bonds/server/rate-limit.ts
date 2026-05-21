import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@bondcheck/db";
import type { RateLimiter, RateLimitResult, RateLimitRule } from "@bondcheck/shared";

/**
 * Fixed window limiter on the `rate_limits` table (PLAN section 11): one upsert per request,
 * atomic on Postgres. Keys hold a keyed hash of the client, never a raw address.
 */
export function pgRateLimiter(db: Db, now: () => number = Date.now): RateLimiter {
  return {
    async hit(rule: RateLimitRule, subject: string): Promise<RateLimitResult> {
      const windowMs = rule.windowSeconds * 1000;
      const t = now();
      const windowStart = new Date(Math.floor(t / windowMs) * windowMs);
      const key = `${rule.name}:${subject}`;
      const res = await db.execute(sql`
        insert into rate_limits (key, window_start, count) values (${key}, ${windowStart.toISOString()}, 1)
        on conflict (key, window_start) do update set count = rate_limits.count + 1
        returning count`);
      const rows = Array.isArray(res) ? res : ((res as { rows?: { count: number }[] }).rows ?? []);
      const count = Number((rows[0] as { count?: number } | undefined)?.count ?? 1);
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - t) / 1000));
      return { allowed: count <= rule.limit, remaining: Math.max(rule.limit - count, 0), retryAfterSeconds };
    },
  };
}

/** Checks of up to 1,000 numbers each: generous for people, tight for scrapers. */
export const CHECK_RULE: RateLimitRule = { name: "bonds-check", limit: 20, windowSeconds: 60 };

function clientAddress(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * HMAC of the client address with a server secret and the current day, so the stored key cannot
 * be reversed to an address and does not link a visitor across days.
 */
export async function clientSubject(headers: Headers, now = new Date()): Promise<string> {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.WALLET_PEPPER ?? process.env.CRON_SECRET ?? "bondcheck-rate-limit";
  const day = now.toISOString().slice(0, 10);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`${secret}|${day}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(clientAddress(headers)));
  return Array.from(new Uint8Array(mac).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

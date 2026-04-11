export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

export interface RateLimitRule {
  /** Logical bucket, e.g. "bonds-check" or "wallet-restore". */
  name: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed window limiter. The Postgres implementation (rate_limits table) lives with the lane
 * that needs it; Cloudflare can swap in the Rate Limiting binding behind the same interface.
 * `subject` must already be a hash (never a raw IP address).
 */
export interface RateLimiter {
  hit(rule: RateLimitRule, subject: string): Promise<RateLimitResult>;
}

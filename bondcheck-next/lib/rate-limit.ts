import { NextRequest, NextResponse } from "next/server";

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const STALE_THRESHOLD = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > STALE_THRESHOLD) {
      buckets.delete(key);
    }
  }
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Token-bucket rate limiter.
 * @param request - The incoming request
 * @param maxTokens - Max burst capacity (e.g. 5)
 * @param refillRate - Tokens added per second (e.g. 3 = 3 req/sec sustained)
 * @param prefix - Namespace to separate different route limits
 */
export function rateLimit(
  request: NextRequest,
  maxTokens: number,
  refillRate: number,
  prefix: string
): { success: boolean; response?: NextResponse } {
  cleanup();

  const ip = getClientIP(request);
  const key = `${prefix}:${ip}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((1 - bucket.tokens) / refillRate);
    return {
      success: false,
      response: NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(maxTokens),
            "X-RateLimit-Remaining": "0",
          },
        }
      ),
    };
  }

  bucket.tokens -= 1;

  return { success: true };
}

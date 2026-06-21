import "server-only";
import type { z } from "zod";
import type { AnyEndpoint } from "@bondcheck/shared";
import { attributionFor } from "@bondcheck/ingest/markets/sources";
import { errorResponse, jsonResponse } from "@/server/http";
import { getDb } from "@/server/db";
import { MarketsNotFoundError, MarketsUnavailableError, type Result } from "./service";
import { getMarketsStore, type MarketsStore } from "./store";
import { clientSubject, MARKETS_READ_RULE, PgRateLimiter } from "./rate-limit";

export interface MarketsRouteDeps {
  store: () => MarketsStore;
  /** Returns seconds to wait when the caller is over the limit, null when allowed. */
  limit: (request: Request) => Promise<number | null>;
}

async function defaultLimit(request: Request): Promise<number | null> {
  if (process.env.MARKETS_FIXTURE_FILE) return null;
  const subject = await clientSubject(request);
  if (!subject) return null;
  try {
    const r = await new PgRateLimiter(getDb()).hit(MARKETS_READ_RULE, subject);
    return r.allowed ? null : r.retryAfterSeconds;
  } catch {
    // The limiter must never take a public, cacheable read down with it.
    return null;
  }
}

export const defaultDeps: MarketsRouteDeps = { store: getMarketsStore, limit: defaultLimit };

/** Cached at the CDN for 5 minutes, served stale for an hour while revalidating. */
const CACHE = { sMaxAge: 300, staleWhileRevalidate: 3600 };

/**
 * Wraps a GET handler: validates the query with the endpoint's zod schema, rate limits, maps
 * domain errors to stable codes and adds attribution to `meta`. Messages never echo internals.
 */
export function marketsGet<E extends AnyEndpoint>(
  endpoint: E,
  handler: (query: z.infer<NonNullable<E["query"]>>, store: MarketsStore) => Promise<Result<unknown>>,
  deps: MarketsRouteDeps = defaultDeps,
) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const parsed = endpoint.query!.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      const details = parsed.error.issues.map((i: z.core.$ZodIssue) => ({ path: i.path.join("."), message: i.message }));
      return errorResponse("bad_request", "invalid query parameters", details);
    }
    const retryAfter = await deps.limit(request);
    if (retryAfter !== null) {
      const res = errorResponse("rate_limited", "too many requests, slow down");
      res.headers.set("Retry-After", String(retryAfter));
      return res;
    }
    let store: MarketsStore;
    try {
      store = deps.store();
    } catch {
      return errorResponse("unavailable", "market data is temporarily unavailable");
    }
    try {
      const result = await handler(parsed.data, store);
      return jsonResponse(result.data, {
        meta: { attribution: attributionFor(result.sources), generatedAt: new Date().toISOString() },
        cache: CACHE,
      });
    } catch (error) {
      if (error instanceof MarketsNotFoundError) return errorResponse("not_found", error.message);
      if (error instanceof MarketsUnavailableError) return errorResponse("unavailable", error.message);
      console.error(`[${endpoint.id}]`, error);
      return errorResponse("unavailable", "market data is temporarily unavailable");
    }
  };
}

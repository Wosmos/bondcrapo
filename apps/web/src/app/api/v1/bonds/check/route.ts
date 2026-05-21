import { checkBonds } from "@bondcheck/shared";
import { errorResponse, failure, jsonResponse, parseInput } from "@/features/bonds/server/api";
import { checkNumbers } from "@/features/bonds/server/check";
import { codeFromSlug } from "@/features/bonds/labels";
import { CHECK_RULE, clientSubject, pgRateLimiter } from "@/features/bonds/server/rate-limit";
import { read } from "@/features/bonds/server/repo";

export const dynamic = "force-dynamic";

/** Bodies above this size are rejected before parsing (1,000 items fit comfortably). */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /api/v1/bonds/check { items: [{ denomination?, number | from,to }] }: at most 1,000
 * expanded numbers per request, rate limited per client. The numbers are never logged.
 */
export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return errorResponse("bad_request", "request body too large");
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return errorResponse("bad_request", "request body too large");
    body = JSON.parse(text);
  } catch {
    return errorResponse("bad_request", "body must be JSON");
  }
  const input = parseInput(checkBonds.body, body);
  if (!input.ok) return input.response;
  if (input.value.items.some((i) => i.denomination !== undefined && !codeFromSlug(i.denomination))) {
    return errorResponse("bad_request", "denomination: unknown denomination");
  }

  try {
    const result = await read(async (repo) => {
      if (repo.db) {
        const limit = await pgRateLimiter(repo.db).hit(CHECK_RULE, await clientSubject(request.headers));
        if (!limit.allowed) return { limited: limit.retryAfterSeconds } as const;
      }
      return { data: await checkNumbers(repo, input.value) } as const;
    });
    if ("limited" in result) {
      const res = errorResponse("rate_limited", "Too many checks. Please wait a moment and try again.");
      res.headers.set("Retry-After", String(result.limited));
      return res;
    }
    const res = jsonResponse(result.data);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    return failure(error);
  }
}

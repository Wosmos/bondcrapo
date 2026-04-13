import { NextResponse } from "next/server";
import { HTTP_STATUS_FOR_ERROR, type ErrorCode } from "@bondcheck/shared";

/** `{ error: { code, message } }` with the stable status for the code (PLAN section 6). */
export function errorResponse(code: ErrorCode, message: string, details?: unknown): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status: HTTP_STATUS_FOR_ERROR[code], headers: { "Cache-Control": "no-store" } },
  );
}

/** What every unbuilt /api/v1 endpoint answers until its lane implements it. */
export function notImplemented(endpointId: string): NextResponse {
  return errorResponse("not_implemented", `${endpointId} is not implemented yet`);
}

export interface JsonOptions {
  meta?: Record<string, unknown>;
  status?: number;
  /** Seconds. Public GETs set `Cache-Control: public, s-maxage=<n>, stale-while-revalidate=<m>`. */
  cache?: { sMaxAge: number; staleWhileRevalidate: number };
}

/** `{ data, meta }` success envelope. */
export function jsonResponse<T>(data: T, options: JsonOptions = {}): NextResponse {
  const headers: Record<string, string> = {};
  if (options.cache) {
    headers["Cache-Control"] =
      `public, s-maxage=${options.cache.sMaxAge}, stale-while-revalidate=${options.cache.staleWhileRevalidate}`;
  }
  return NextResponse.json(
    { data, ...(options.meta ? { meta: options.meta } : {}) },
    { status: options.status ?? 200, headers },
  );
}

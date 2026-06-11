import "server-only";
import { NextResponse } from "next/server";
import type { ReleaseLookup } from "./releases";

/** Successful release responses are cached at the edge for 5 minutes, failures for 1. */
export const RELEASE_CACHE = "public, s-maxage=300, stale-while-revalidate=3600";
export const RELEASE_FAILURE_CACHE = "public, s-maxage=60";

/** The public view of the latest release (contract `releaseSchema`): no token, no GitHub URLs. */
export function publicRelease(lookup: ReleaseLookup) {
  if (lookup.status !== "ok") return lookup;
  const { version, name, publishedAt, notes, downloads } = lookup.release;
  return { status: "ok" as const, version, name, publishedAt, notes, downloads };
}

export function rawJson(body: unknown, status: number, cache: string): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": cache } });
}

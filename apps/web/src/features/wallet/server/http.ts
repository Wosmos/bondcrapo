import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { WALLET_COOKIE, formatWalletCookieValue, readWalletCredentials, type WalletCredentials } from "@bondcheck/shared";
import { errorResponse, jsonResponse } from "@/server/http";

/** 5,000 bonds with labels is about 450 KB of JSON; anything far beyond that is not a wallet request. */
export const MAX_BODY_BYTES = 1_000_000;
/** Chrome caps cookie lifetime at 400 days; the wallet itself never expires. */
const COOKIE_MAX_AGE = 400 * 24 * 3600;

export class HttpError extends Error {
  constructor(
    readonly response: Response,
    message = "http error",
  ) {
    super(message);
  }
}

/** Private, per-wallet data: never cached by browsers, CDNs or the service worker. */
export function privateJson<T>(data: T, status = 200): NextResponse {
  const res = jsonResponse(data, { status });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export function rateLimited(retryAfterSeconds: number): NextResponse {
  const res = errorResponse("rate_limited", "Too many attempts. Please wait and try again.", { retryAfterSeconds });
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}

function isSecure(req: NextRequest): boolean {
  return req.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
}

export function setWalletCookie(res: NextResponse, req: NextRequest, credentials: WalletCredentials): void {
  res.cookies.set(WALLET_COOKIE, formatWalletCookieValue(credentials), {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearWalletCookie(res: NextResponse, req: NextRequest): void {
  res.cookies.set(WALLET_COOKIE, "", { httpOnly: true, secure: isSecure(req), sameSite: "lax", path: "/", maxAge: 0 });
}

export function credentialsFrom(req: NextRequest): { credentials: WalletCredentials | null; viaCookie: boolean } {
  const authorization = req.headers.get("authorization");
  const fromHeader = readWalletCredentials({ authorization });
  if (fromHeader) return { credentials: fromHeader, viaCookie: false };
  const cookie = req.cookies.get(WALLET_COOKIE)?.value ?? null;
  return { credentials: readWalletCredentials({ cookie }), viaCookie: cookie !== null };
}

/**
 * Cross-site request forgery guard for state changing requests. SameSite=Lax already keeps the
 * cookie off cross-site POSTs; this also blocks login forgery on create and restore, which carry
 * no cookie. Native apps send no Origin and no Sec-Fetch-Site, so they pass.
 */
export function assertSameOrigin(req: NextRequest): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new HttpError(errorResponse("forbidden", "cross-site requests are not allowed"));
  }
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new HttpError(errorResponse("forbidden", "invalid origin"));
    }
    if (originHost !== host) throw new HttpError(errorResponse("forbidden", "cross-site requests are not allowed"));
  }
}

/** Reads and validates a JSON body against a contract schema. Never echoes submitted values. */
export async function readBody<S extends z.ZodType>(req: NextRequest, schema: S, options: { optional?: boolean } = {}): Promise<z.output<S>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new HttpError(errorResponse("bad_request", "request body is too large"));
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(errorResponse("bad_request", "request body is too large"));
  let json: unknown = {};
  if (text.trim() !== "") {
    const type = req.headers.get("content-type") ?? "";
    if (!type.toLowerCase().includes("application/json")) {
      throw new HttpError(errorResponse("bad_request", "expected an application/json body"));
    }
    try {
      json = JSON.parse(text);
    } catch {
      throw new HttpError(errorResponse("bad_request", "body is not valid JSON"));
    }
  } else if (!options.optional) {
    throw new HttpError(errorResponse("bad_request", "a JSON body is required"));
  }
  return parseWith(schema, json);
}

export function parseWith<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new HttpError(errorResponse("bad_request", "request did not match the expected shape", { issues }));
  }
  return parsed.data;
}

/** First hop address as seen by the platform proxy. Only ever used hashed. */
export function clientAddress(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "unknown";
}

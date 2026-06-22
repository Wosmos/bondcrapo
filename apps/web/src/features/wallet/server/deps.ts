import "server-only";
import { neonConfig } from "@neondatabase/serverless";
import type { Db } from "@bondcheck/db";
import { createPgRateLimiter, type RateLimiter } from "@bondcheck/db/queries/wallet";
import { getDb } from "@/server/db";
import { serverEnv } from "@/platform/env";
import type { VapidConfig } from "./web-push";

/**
 * Everything the wallet API needs from the outside world, injected so route handler tests run on
 * PGlite with a fixed clock and the production path stays a thin default.
 */
export interface WalletDeps {
  db: Db;
  /** HMAC key for token, sync code and client address hashes (WALLET_PEPPER). */
  pepper: string;
  limiter: RateLimiter;
  now(): Date;
  /** Present only when all three VAPID variables are set. */
  vapid: VapidConfig | null;
}

export class WalletUnavailableError extends Error {}

// End-to-end tests point the Neon HTTP driver at a local PGlite bridge. Never in production builds.
const e2eSqlEndpoint = process.env.WALLET_E2E_SQL_ENDPOINT;
if (e2eSqlEndpoint && process.env.NODE_ENV !== "production") {
  neonConfig.fetchEndpoint = () => e2eSqlEndpoint;
}

export function vapidFromEnv(): VapidConfig | null {
  const env = serverEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return null;
  return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT };
}

export function defaultWalletDeps(): WalletDeps {
  const env = serverEnv();
  if (!env.WALLET_PEPPER || !env.DATABASE_URL) {
    throw new WalletUnavailableError("wallets are not configured on this server");
  }
  const db = getDb();
  return {
    db,
    pepper: env.WALLET_PEPPER,
    limiter: createPgRateLimiter(db),
    now: () => new Date(),
    vapid: vapidFromEnv(),
  };
}

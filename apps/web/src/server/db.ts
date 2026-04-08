import { createDb, type Db } from "@bondcheck/db";

let cached: Db | undefined;

/**
 * Lazy database handle (Neon HTTP). Nothing connects at import time, so `next build` works
 * with no environment variables. Throws a clear error when DATABASE_URL is missing at request time.
 */
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cached = createDb(url);
  }
  return cached;
}

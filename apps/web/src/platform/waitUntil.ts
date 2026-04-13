import { after } from "next/server";

/**
 * Runs work after the response has been sent. Wraps `next/server` `after` so the Cloudflare
 * adapter can swap in `ctx.waitUntil`. Outside a request scope the promise is just left running.
 */
export function waitUntil(work: Promise<unknown>): void {
  try {
    after(() => work);
  } catch {
    void work.catch(() => undefined);
  }
}

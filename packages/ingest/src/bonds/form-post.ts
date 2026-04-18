import { FetchError, sha256Hex, type FetchResult } from "../fetcher";

export interface FormPosterOptions {
  userAgent: string;
  /** Gap between requests to the same host. Default 2500 ms. */
  minIntervalMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/**
 * The official legacy search is a PHP form: its date lists and number search only answer POST.
 * `Fetcher` is GET only, so this small client applies the same politeness (identifying
 * User-Agent, per host spacing, timeout, retry on 429/5xx) to the handful of POSTs the
 * backfill and schedule jobs make. (Request filed to fold this into `Fetcher`.)
 */
export class FormPoster {
  private readonly opts: Required<FormPosterOptions>;
  private nextAllowed = new Map<string, number>();

  constructor(options: FormPosterOptions) {
    this.opts = {
      minIntervalMs: 2500,
      timeoutMs: 20_000,
      maxRetries: 2,
      fetch: (...args) => globalThis.fetch(...args),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
      ...options,
    };
  }

  async post(url: string, form: Record<string, string>): Promise<FetchResult> {
    const host = new URL(url).host;
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      const now = this.opts.now();
      const at = Math.max(this.nextAllowed.get(host) ?? 0, now);
      this.nextAllowed.set(host, at + this.opts.minIntervalMs);
      if (at > now) await this.opts.sleep(at - now);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
      try {
        const res = await this.opts.fetch(url, {
          method: "POST",
          headers: {
            "User-Agent": this.opts.userAgent,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "text/html,*/*",
          },
          body: new URLSearchParams(form).toString(),
          signal: controller.signal,
        });
        if ((res.status === 429 || res.status >= 500) && attempt < this.opts.maxRetries) {
          await res.arrayBuffer().catch(() => undefined);
          await this.opts.sleep(1000 * 2 ** attempt);
          lastError = new FetchError(`HTTP ${res.status}`, url, res.status);
          continue;
        }
        const raw = new Uint8Array(await res.arrayBuffer());
        return {
          url,
          status: res.status,
          ok: res.ok,
          notModified: false,
          contentType: res.headers.get("content-type"),
          etag: null,
          lastModified: null,
          fetchedAt: new Date(this.opts.now()),
          body: new TextDecoder("utf-8").decode(raw),
          byteLength: raw.byteLength,
          sha256: await sha256Hex(raw),
        };
      } catch (error) {
        lastError = error;
        if (attempt < this.opts.maxRetries) await this.opts.sleep(1000 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof FetchError
      ? lastError
      : new FetchError(lastError instanceof Error ? lastError.message : "request failed", url);
  }
}

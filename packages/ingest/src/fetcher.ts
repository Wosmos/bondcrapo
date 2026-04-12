export interface FetcherOptions {
  /** Identifying User-Agent, e.g. `BondCheckBot/1.0 (+https://<site>/about/data)`. */
  userAgent: string;
  /** Minimum gap between requests to the same host. Default 2000 ms (PLAN section 4.1). */
  minIntervalMs?: number;
  /** Per host override of `minIntervalMs`. */
  hostIntervalsMs?: Record<string, number>;
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

export interface FetchRequest {
  headers?: Record<string, string>;
  /** Sent as If-None-Match; a 304 answer returns `notModified: true`. */
  etag?: string;
  /** Sent as If-Modified-Since. */
  lastModified?: string;
  /** Include the raw bytes (PDFs). Text is always decoded as UTF-8 unless `bytes` only is wanted. */
  bytes?: boolean;
}

export interface FetchResult {
  url: string;
  status: number;
  ok: boolean;
  notModified: boolean;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: Date;
  /** Decoded body (empty for 304 and for `bytes` requests of binary content). */
  body: string;
  /** Raw body when `bytes: true`. */
  data?: Uint8Array;
  byteLength: number;
  /** Lowercase hex sha256 of the raw bytes: the content address in `source_documents`. */
  sha256: string;
}

export class FetchError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Polite HTTP client for scrapers: per host spacing, timeout, retries with exponential backoff
 * and jitter on 429/5xx (honouring Retry-After), conditional requests, content hashing.
 * Runtime agnostic: only `fetch` and Web Crypto.
 */
export class Fetcher {
  private readonly opts: Required<Omit<FetcherOptions, "hostIntervalsMs" | "fetch">> & {
    hostIntervalsMs: Record<string, number>;
    fetch: typeof fetch;
  };
  private readonly nextAllowed = new Map<string, number>();

  constructor(options: FetcherOptions) {
    this.opts = {
      minIntervalMs: 2000,
      timeoutMs: 20_000,
      maxRetries: 3,
      baseBackoffMs: 1000,
      hostIntervalsMs: {},
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
      random: Math.random,
      fetch: (...args) => globalThis.fetch(...args),
      ...options,
    };
  }

  get userAgent(): string {
    return this.opts.userAgent;
  }

  private async waitForSlot(host: string): Promise<void> {
    const interval = this.opts.hostIntervalsMs[host] ?? this.opts.minIntervalMs;
    const now = this.opts.now();
    const allowedAt = Math.max(this.nextAllowed.get(host) ?? 0, now);
    // Reserve the slot before sleeping so concurrent callers queue up behind each other.
    this.nextAllowed.set(host, allowedAt + interval);
    if (allowedAt > now) await this.opts.sleep(allowedAt - now);
  }

  async get(url: string, req: FetchRequest = {}): Promise<FetchResult> {
    const host = new URL(url).host;
    const headers: Record<string, string> = {
      "User-Agent": this.opts.userAgent,
      Accept: "*/*",
      ...req.headers,
    };
    if (req.etag) headers["If-None-Match"] = req.etag;
    if (req.lastModified) headers["If-Modified-Since"] = req.lastModified;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      await this.waitForSlot(host);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
      try {
        const res = await this.opts.fetch(url, {
          headers,
          signal: controller.signal,
          redirect: "follow",
        });
        if (RETRYABLE.has(res.status) && attempt < this.opts.maxRetries) {
          await res.arrayBuffer().catch(() => undefined);
          await this.opts.sleep(this.backoff(attempt, res.headers.get("retry-after")));
          lastError = new FetchError(`HTTP ${res.status}`, url, res.status);
          continue;
        }
        if (RETRYABLE.has(res.status))
          throw new FetchError(`HTTP ${res.status} after ${attempt + 1} attempts`, url, res.status);
        const raw = new Uint8Array(await res.arrayBuffer());
        return {
          url,
          status: res.status,
          ok: res.ok,
          notModified: res.status === 304,
          contentType: res.headers.get("content-type"),
          etag: res.headers.get("etag"),
          lastModified: res.headers.get("last-modified"),
          fetchedAt: new Date(this.opts.now()),
          body: req.bytes ? "" : new TextDecoder("utf-8").decode(raw),
          data: req.bytes ? raw : undefined,
          byteLength: raw.byteLength,
          sha256: await sha256Hex(raw),
        };
      } catch (error) {
        lastError = error;
        if (error instanceof FetchError && error.status !== undefined) break;
        if (attempt < this.opts.maxRetries) await this.opts.sleep(this.backoff(attempt, null));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof FetchError
      ? lastError
      : new FetchError(lastError instanceof Error ? lastError.message : "request failed", url);
  }

  private backoff(attempt: number, retryAfter: string | null): number {
    const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
    const exp = this.opts.baseBackoffMs * 2 ** attempt;
    return exp + Math.floor(this.opts.random() * exp * 0.25);
  }
}

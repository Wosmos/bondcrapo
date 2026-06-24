import type { z } from "zod";
import { API_PREFIX, apiErrorSchema, type ErrorCode } from "./api/common";
import type { AnyEndpoint, EndpointInput, InferResponse } from "./api/endpoint";

export class ApiError extends Error {
  readonly code: ErrorCode | "network" | "invalid_response";
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiError["code"], message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ApiClientOptions {
  /** Origin, e.g. "https://bondcheck.example". Empty string means same origin (browser). */
  baseUrl?: string;
  /** Defaults to the global fetch (works in browsers, Node 22 and React Native). */
  fetch?: typeof fetch;
  /**
   * Value for the `Authorization` header of wallet endpoints, e.g. from `formatWalletAuthHeader`.
   * Web leaves this unset and relies on the httpOnly cookie via `credentials: "include"`.
   */
  getAuthorization?: () => string | undefined | Promise<string | undefined>;
  /** Extra headers on every request (e.g. a User-Agent in Node). */
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  /** Skip response validation (not recommended). */
  validate?: boolean;
}

export interface ApiResult<E extends AnyEndpoint> {
  data: InferResponse<E>;
  meta: Record<string, unknown> | undefined;
}

/** Fills `{param}` placeholders. */
export function buildPath(path: string, params: Record<string, unknown> | undefined): string {
  return path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params?.[key];
    if (value === undefined || value === null) throw new Error(`missing path parameter: ${key}`);
    return encodeURIComponent(String(value));
  });
}

function toSearch(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Fetch based typed client for `/api/v1`, shared by the web app and the Expo app. */
export class ApiClient {
  private readonly opts: ApiClientOptions;

  constructor(options: ApiClientOptions = {}) {
    this.opts = options;
  }

  url(endpoint: AnyEndpoint, input?: { params?: unknown; query?: unknown }): string {
    const base = (this.opts.baseUrl ?? "").replace(/\/$/, "");
    const params = input?.params as Record<string, unknown> | undefined;
    const query = input?.query as Record<string, unknown> | undefined;
    return `${base}${API_PREFIX}${buildPath(endpoint.path, params)}${toSearch(query)}`;
  }

  async call<E extends AnyEndpoint>(endpoint: E, input?: EndpointInput<E>): Promise<ApiResult<E>> {
    const i = (input ?? {}) as { params?: unknown; query?: unknown; body?: unknown };
    // Never call fetch as a method of another object: browsers throw "Illegal invocation" when
    // `window.fetch` runs with a `this` other than the window, so it is always invoked on globalThis.
    const custom = this.opts.fetch;
    const doFetch: typeof fetch = custom
      ? (url, init) => custom.call(globalThis, url, init)
      : (url, init) => globalThis.fetch(url, init);
    const headers: Record<string, string> = { Accept: "application/json", ...this.opts.headers };
    if (endpoint.auth === "wallet" && this.opts.getAuthorization) {
      const auth = await this.opts.getAuthorization();
      if (auth) headers.Authorization = auth;
    }
    let body: string | undefined;
    if (i.body !== undefined) {
      body = JSON.stringify(i.body);
      headers["Content-Type"] = "application/json";
    }

    let res: Response;
    try {
      res = await doFetch(this.url(endpoint, i), {
        method: endpoint.method,
        headers,
        body,
        credentials: this.opts.credentials,
      });
    } catch (cause) {
      throw new ApiError("network", cause instanceof Error ? cause.message : "network error", 0);
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new ApiError("invalid_response", "response was not JSON", res.status);
    }

    if (!res.ok) {
      const parsed = apiErrorSchema.safeParse(json);
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new ApiError(code, message, res.status, details);
      }
      throw new ApiError("invalid_response", `HTTP ${res.status}`, res.status);
    }

    const envelope = json as { data?: unknown; meta?: Record<string, unknown> };
    if (this.opts.validate === false) {
      return { data: envelope.data as InferResponse<E>, meta: envelope.meta };
    }
    const parsed = (endpoint.response as z.ZodType).safeParse(envelope.data);
    if (!parsed.success) {
      throw new ApiError("invalid_response", "response did not match the contract", res.status, parsed.error.issues);
    }
    return { data: parsed.data as InferResponse<E>, meta: envelope.meta };
  }
}

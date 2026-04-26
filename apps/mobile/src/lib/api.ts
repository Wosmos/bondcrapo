import { ApiClient, ApiError, formatWalletAuthHeader } from "@bondcheck/shared";
import { apiBaseUrl, appVersion } from "./config";
import { readCredentials } from "./wallet-store";

let client: ApiClient | null = null;

export class NotConfiguredError extends Error {
  constructor() {
    super("The app was built without a website address.");
    this.name = "NotConfiguredError";
  }
}

/** Typed client for /api/v1 (zod-validated responses from @bondcheck/shared). */
export function api(): ApiClient {
  if (client) return client;
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new NotConfiguredError();
  client = new ApiClient({
    baseUrl,
    headers: { "X-BondCheck-Client": `android/${appVersion()}` },
    getAuthorization: async () => {
      const credentials = await readCredentials();
      return credentials ? formatWalletAuthHeader(credentials) : undefined;
    },
  });
  return client;
}

/** Test hook. */
export function setApiClient(next: ApiClient | null): void {
  client = next;
}

export type ErrorKind = "offline" | "unavailable" | "comingSoon" | "unauthorized" | "rateLimited" | "invalid" | "notFound" | "unknown" | "notConfigured";

/** Maps any thrown error to a message key family, so screens never show raw server text. */
export function classifyError(error: unknown): ErrorKind {
  if (error instanceof NotConfiguredError) return "notConfigured";
  if (error instanceof ApiError) {
    switch (error.code) {
      case "network":
        return "offline";
      case "not_implemented":
        return "comingSoon";
      case "unavailable":
      case "internal":
        return "unavailable";
      case "unauthorized":
      case "forbidden":
        return "unauthorized";
      case "rate_limited":
        return "rateLimited";
      case "bad_request":
        return "invalid";
      case "not_found":
        return "notFound";
      case "invalid_response":
        return error.status >= 500 ? "unavailable" : "unknown";
      default:
        return "unknown";
    }
  }
  return "unknown";
}

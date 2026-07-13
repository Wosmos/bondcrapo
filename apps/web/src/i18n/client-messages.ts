import type { AbstractIntlMessages } from "next-intl";

/**
 * Messages sent to the browser by the root layout. Only what shell client islands use, so legal
 * pages and other namespaces never bloat every page's payload. A feature whose client components
 * call `useTranslations` wraps that island in `<ClientMessages locale paths>` (`./ClientMessages`),
 * which adds just the message paths the island uses.
 */
export const CLIENT_PATHS = ["common.actions", "common.status", "common.grid", "common.bondTabs"] as const;

function getPath(obj: AbstractIntlMessages, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = obj;
  for (const key of keys.slice(0, -1)) cur = (cur[key] ??= {}) as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
}

export function pickPaths(messages: AbstractIntlMessages, paths: readonly string[]): AbstractIntlMessages {
  const out: Record<string, unknown> = {};
  for (const p of paths) {
    const value = getPath(messages, p);
    if (value !== undefined) setPath(out, p, value);
  }
  return out as AbstractIntlMessages;
}

export const pickNamespaces = (messages: AbstractIntlMessages, namespaces: readonly string[]): AbstractIntlMessages =>
  pickPaths(messages, namespaces);

export const clientMessages = (messages: AbstractIntlMessages): AbstractIntlMessages => pickPaths(messages, CLIENT_PATHS);

/** `{ a: { b: "x" } }` to `{ "a.b": "x" }`: plain string props for islands that skip the ICU runtime. */
export function flattenMessages(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof v === "string") out[path] = v;
    else if (v && typeof v === "object") Object.assign(out, flattenMessages(v as Record<string, unknown>, path));
  }
  return out;
}

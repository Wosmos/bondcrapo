import type { AppLocale } from "./types";
import enApp from "./messages/en.json";
import urApp from "./messages/ur.json";
import enCommon from "./web/en/common.json";
import urCommon from "./web/ur/common.json";

export type Messages = typeof enApp;
type Values = Record<string, string | number>;

/** `common` comes from the website (copied by scripts/sync-messages.mjs); the rest is app only. */
const MESSAGES: Record<AppLocale, Record<string, unknown>> = {
  en: { ...enApp, common: enCommon },
  ur: { ...urApp, common: urCommon },
};

function lookup(tree: Record<string, unknown>, key: string): unknown {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function interpolate(template: string, values?: Values): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] === undefined ? match : String(values[name]),
  );
}

/**
 * Looks up `key` in the locale, falling back to English and then to the key itself so a
 * missing translation never crashes a screen. With a numeric `count`, `<key>_one` and
 * `<key>_other` are tried first (both locales use the same one/other split).
 */
export function translate(locale: AppLocale, key: string, values?: Values): string {
  const count = values?.count;
  const candidates =
    typeof count === "number" ? [`${key}_${count === 1 ? "one" : "other"}`, key] : [key];
  for (const tree of [MESSAGES[locale], MESSAGES.en]) {
    for (const candidate of candidates) {
      const hit = lookup(tree, candidate);
      if (typeof hit === "string") return interpolate(hit, values);
    }
  }
  return key;
}

export type TFunction = (key: string, values?: Values) => string;

export function createT(locale: AppLocale): TFunction {
  return (key, values) => translate(locale, key, values);
}

/** Every leaf key of a message tree (used by the parity test). */
export function messageKeys(tree: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    v !== null && typeof v === "object"
      ? messageKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

export const RAW_MESSAGES = { en: enApp, ur: urApp } as const;

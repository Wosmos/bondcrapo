import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { navItems } from "@/features/registry";
import { MESSAGE_NAMESPACES } from "./request";

const load = (locale: string, ns: string) =>
  JSON.parse(readFileSync(new URL(`../../messages/${locale}/${ns}.json`, import.meta.url), "utf8")) as Record<string, unknown>;

/** Flattens to "a.b.0.c" => value, so arrays of sections are compared too. */
function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Record<string, string>>(
      (acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }),
      {},
    );
  }
  return {};
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

describe("common namespace (Lane D)", () => {
  const en = flatten(load("en", "common"));
  const ur = flatten(load("ur", "common"));

  it("has the same keys in English and Urdu", () => {
    expect(Object.keys(ur).sort()).toEqual(Object.keys(en).sort());
  });

  it("uses the same ICU placeholders in both locales", () => {
    for (const key of Object.keys(en)) expect(placeholders(ur[key]), key).toEqual(placeholders(en[key]));
  });

  it("has no empty strings and no em dashes", () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(ur)]) {
      expect(value.trim(), key).not.toBe("");
      expect(value, key).not.toContain("\u2014");
    }
  });

  it("is actually translated: most Urdu strings contain Arabic script", () => {
    const values = Object.values(ur);
    const urdu = values.filter((v) => /[؀-ۿ]/.test(v));
    expect(urdu.length / values.length).toBeGreaterThan(0.85);
  });
});

describe("navigation labels", () => {
  it.each(["en", "ur"])("every registered nav item has a label in %s", (locale) => {
    const all = Object.fromEntries(MESSAGE_NAMESPACES.map((ns) => [ns, load(locale, ns)]));
    const flat = flatten(all);
    for (const item of navItems) expect(flat[item.labelKey], item.labelKey).toBeTruthy();
  });
});

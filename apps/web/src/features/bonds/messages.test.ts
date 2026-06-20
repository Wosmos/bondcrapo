import { describe, expect, it } from "vitest";
import en from "../../../messages/en/bonds.json";
import ur from "../../../messages/ur/bonds.json";

function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function leaves(obj: unknown): string[] {
  if (typeof obj === "string") return [obj];
  if (typeof obj !== "object" || obj === null) return [];
  return Object.values(obj).flatMap(leaves);
}

describe("bonds messages", () => {
  it("has the same keys in English and Urdu", () => {
    expect(keys(ur).sort()).toEqual(keys(en).sort());
  });

  it("keeps every placeholder in both languages", () => {
    // Argument names only: plural branch bodies ("=0 {today}") are translated text.
    const placeholders = (s: string) => {
      let rest = s;
      for (let i = 0; i < 5; i++) rest = rest.replace(/(=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\}/g, "");
      return [...rest.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
    };
    const flat = (o: unknown, p = ""): [string, string][] =>
      typeof o === "string" ? [[p, o]] : Object.entries(o as object).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k));
    const urMap = new Map(flat(ur));
    for (const [key, value] of flat(en)) expect(placeholders(urMap.get(key) ?? ""), key).toEqual(placeholders(value));
  });

  it("uses no em dashes and no Eastern digits in Urdu copy", () => {
    for (const s of [...leaves(en), ...leaves(ur)]) expect(s).not.toMatch(/\u2014/);
    for (const s of leaves(ur)) expect(s).not.toMatch(/[\u06F0-\u06F9\u0660-\u0669]/);
  });
});

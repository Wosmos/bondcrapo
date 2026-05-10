import { describe, expect, it } from "vitest";
import en from "../../../../messages/en/wallet.json";
import ur from "../../../../messages/ur/wallet.json";
import { collectLegacyBonds } from "./legacy-history";
import { buildPushMessage } from "../server/notify";

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

/** Top level ICU argument names, e.g. {count, plural, ...} and {amount}. */
const args = (s: string) => [...s.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();

describe("wallet messages", () => {
  const e = flatten(en as Tree);
  const u = flatten(ur as Tree);

  it("Urdu has exactly the English keys", () => {
    expect(Object.keys(u).sort()).toEqual(Object.keys(e).sort());
  });

  it("every message keeps the same placeholders and rich tags in both languages", () => {
    for (const key of Object.keys(e)) {
      expect(new Set(args(u[key]!)), key).toEqual(new Set(args(e[key]!)));
      expect(tags(u[key]!), key).toEqual(tags(e[key]!));
    }
  });

  it("contains no em dashes", () => {
    for (const s of [...Object.values(e), ...Object.values(u)]) expect(s).not.toContain("\u2014");
  });
});

describe("legacy history migration", () => {
  it("collects unique numbers and uses denominations revealed by past wins", () => {
    const bonds = collectLegacyBonds([
      { bondNumbers: ["123456", "654321", "12345", 111111] },
      {
        bondNumbers: ["123456", "222222"],
        results: { "123456": [{ denomination: 750 }, { denomination: 1500 }], "222222": [{ denomination: "Rs 200" }] },
      },
      { bondNumbers: "not-an-array" },
    ]);
    expect(bonds).toEqual(
      expect.arrayContaining([
        { bondNumber: "654321", denominationCode: null },
        { bondNumber: "111111", denominationCode: null },
        { bondNumber: "123456", denominationCode: "750" },
        { bondNumber: "123456", denominationCode: "1500" },
        { bondNumber: "222222", denominationCode: "200" },
      ]),
    );
    expect(bonds).toHaveLength(5);
  });
});

describe("push message text", () => {
  it("is localised with Western digits", () => {
    const one = buildPushMessage("ur", [{ bondNumber: 4567, denominationCode: "750", amountPkr: 9300, drawDate: "2026-05-15" }]);
    expect(one.url).toBe("/ur/my/wins");
    expect(one.body).toContain("004567");
    expect(one.body).toContain("9,300");
    expect(one.body).not.toMatch(/[۰-۹]/);
    const many = buildPushMessage(null, [
      { bondNumber: 1, denominationCode: "200", amountPkr: 1000, drawDate: "2026-05-15" },
      { bondNumber: 2, denominationCode: "200", amountPkr: 2000, drawDate: "2026-05-15" },
    ]);
    expect(many.body).toBe("2 of your bonds won in recent draws, Rs 3,000 in total.");
  });
});

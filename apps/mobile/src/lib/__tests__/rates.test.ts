import { fxTable, rateTable, readAttribution } from "../rates";

const rate = (karat: number, unit: "tola" | "10g" | "g", price: number, kind: "reported" | "derived" = "derived") => ({
  country: "PK",
  city: "",
  metal: "XAU" as const,
  karat,
  unit,
  currency: "PKR",
  price,
  kind,
  source: kind === "reported" ? "apsgja" : "derived",
  date: "2026-06-01",
  observedAt: "2026-06-01T10:00:00Z",
});

describe("rateTable", () => {
  it("pairs tola and 10 g prices per karat and prefers reported over derived", () => {
    const rows = rateTable([
      rate(22, "tola", 400000),
      rate(24, "tola", 437000),
      rate(24, "tola", 437836, "reported"),
      rate(24, "10g", 375377, "reported"),
      rate(24, "g", 37537),
    ]);
    expect(rows.map((r) => r.karat)).toEqual([24, 22]);
    expect(rows[0]!.perTola?.price).toBe(437836);
    expect(rows[0]!.per10g?.kind).toBe("reported");
    expect(rows[1]!.per10g).toBeNull();
  });
});

describe("fxTable", () => {
  it("puts USD first and joins open market with interbank", () => {
    const base = { date: "2026-06-01", source: "x", observedAt: "2026-06-01T10:00:00Z" };
    const rows = fxTable([
      { ...base, currency: "EUR", kind: "open_market", buy: 300, sell: 302 },
      { ...base, currency: "USD", kind: "interbank", buy: 280, sell: 280.4 },
      { ...base, currency: "USD", kind: "open_market", buy: 281, sell: 282 },
    ]);
    expect(rows.map((r) => r.currency)).toEqual(["USD", "EUR"]);
    expect(rows[0]!.interbank?.sell).toBe(280.4);
  });
});

it("reads attribution from response meta defensively", () => {
  expect(readAttribution({ attribution: [{ name: "A", text: "Rates by A" }, { bad: true }] })).toEqual([{ name: "A", text: "Rates by A" }]);
  expect(readAttribution(undefined)).toEqual([]);
});

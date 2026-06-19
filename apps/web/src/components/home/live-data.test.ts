import { describe, expect, it } from "vitest";
import type { DrawSummary } from "@bondcheck/shared/api/bonds";
import { loadBoard, selectGold, selectLatest, selectUsd, type LocalRate, type PkrRate } from "./live-data";

const draw = (code: string, status: DrawSummary["status"] = "verified"): DrawSummary => ({
  id: Math.floor(Math.random() * 1e6),
  denominationCode: code,
  drawNumber: 100,
  drawDate: "2026-10-15",
  city: "Karachi",
  status,
  completeness: "full",
  resultChecksum: null,
  publishedAt: null,
  verifiedAt: null,
});

const rate = (over: Partial<LocalRate>): LocalRate => ({
  country: "PK",
  city: "",
  metal: "XAU",
  karat: 24,
  unit: "tola",
  currency: "PKR",
  price: 400000,
  kind: "derived",
  source: "derived",
  date: "2026-10-15",
  observedAt: "2026-10-15T10:00:00+05:00",
  ...over,
});

const pkr = (over: Partial<PkrRate>): PkrRate => ({
  currency: "USD",
  date: "2026-10-15",
  kind: "open_market",
  buy: 280,
  sell: 281,
  source: "FAP",
  observedAt: "2026-10-15T10:00:00+05:00",
  ...over,
});

describe("board selectors", () => {
  it("orders active denominations first and skips scheduled draws", () => {
    const out = selectLatest([draw("40000"), draw("750"), draw("100"), draw("1500", "scheduled"), draw("40000P")]);
    expect(out.map((d) => d.denominationCode)).toEqual(["100", "750", "40000P", "40000"]);
  });

  it("prefers the newest 24K tola rate, reported over derived on the same day", () => {
    const picked = selectGold([
      rate({ price: 1, date: "2026-10-14", kind: "reported" }),
      rate({ price: 2, kind: "derived" }),
      rate({ price: 3, kind: "reported" }),
      rate({ price: 4, karat: 22, kind: "reported" }),
      rate({ price: 5, unit: "10g", kind: "reported" }),
    ]);
    expect(picked?.price).toBe(3);
    expect(selectGold([rate({ karat: 22 })])).toBeNull();
  });

  it("picks the newest USD open market and interbank rates", () => {
    const out = selectUsd([
      pkr({ buy: 1, date: "2026-10-14" }),
      pkr({ buy: 2 }),
      pkr({ buy: 3, kind: "interbank" }),
      pkr({ buy: 9, currency: "EUR" }),
    ]);
    expect(out.open?.buy).toBe(2);
    expect(out.interbank?.buy).toBe(3);
  });
});

describe("loadBoard through the shared ApiClient", () => {
  it("maps contract-valid responses to ready tiles", async () => {
    const fake: typeof fetch = async (input) => {
      const url = String(input);
      const body = url.includes("/bonds/latest")
        ? { data: [draw("750")] }
        : url.includes("/local-rates")
          ? { data: [rate({ kind: "reported" })] }
          : { data: [pkr({}), pkr({ kind: "interbank" })] };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    };
    const board = await loadBoard(fake);
    expect(board.latest.state).toBe("ready");
    expect(board.gold).toMatchObject({ state: "ready", data: { kind: "reported" } });
    expect(board.usd.state).toBe("ready");
  });

  it("reports errors and empty data per tile instead of failing the page", async () => {
    const fake: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/bonds/latest")) {
        return new Response(JSON.stringify({ error: { code: "not_implemented", message: "x" } }), { status: 501 });
      }
      if (url.includes("/local-rates")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      return new Response(JSON.stringify({ data: [{ nonsense: true }] }), { status: 200 });
    };
    const board = await loadBoard(fake);
    expect(board.latest.state).toBe("error");
    expect(board.gold.state).toBe("empty");
    expect(board.usd.state).toBe("error");
  });
});

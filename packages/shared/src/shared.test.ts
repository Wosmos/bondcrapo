import { describe, expect, it } from "vitest";
import {
  ApiClient,
  ApiError,
  GRAMS_PER_TOLA,
  appEndpoints,
  bondsEndpoints,
  buildPath,
  checkBonds,
  checkRequestSchema,
  convertUnitPrice,
  decimalToScaled,
  derivationPurity,
  divDecimal,
  expandRange,
  formatBondNumber,
  formatWalletAuthHeader,
  getDraw,
  listDenominations,
  marketsEndpoints,
  mulDecimal,
  parseWalletAuthHeader,
  priceFromSpot,
  readWalletCredentials,
  uuidv7,
  walletsEndpoints,
} from "./index";

describe("contracts", () => {
  it("every endpoint declares a response schema, a method and a /-prefixed path", () => {
    const all = {
      ...bondsEndpoints,
      ...marketsEndpoints,
      ...walletsEndpoints,
      ...appEndpoints,
    };
    const ids = new Set<string>();
    for (const e of Object.values(all)) {
      expect(e.response).toBeDefined();
      expect(["GET", "POST", "PUT", "DELETE"]).toContain(e.method);
      expect(e.path.startsWith("/")).toBe(true);
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(35);
  });

  it("covers every endpoint of PLAN section 6", () => {
    const keys = Object.values({
      ...bondsEndpoints,
      ...marketsEndpoints,
      ...walletsEndpoints,
      ...appEndpoints,
    }).map((e) => `${e.method} ${e.path}`);
    for (const expected of [
      "GET /bonds/denominations",
      "GET /bonds/draws",
      "GET /bonds/draws/{denomination}/{drawNumber}",
      "GET /bonds/draws/{denomination}/{drawNumber}/results",
      "GET /bonds/draws/{denomination}/{drawNumber}/results.txt",
      "GET /bonds/latest",
      "GET /bonds/schedule",
      "POST /bonds/check",
      "GET /bonds/coverage",
      "GET /markets/metals/latest",
      "GET /markets/metals/history",
      "GET /markets/local-rates",
      "GET /markets/fx/latest",
      "GET /markets/fx/pkr",
      "GET /markets/fx/history",
      "GET /markets/convert",
      "POST /wallets",
      "POST /wallets/restore",
      "POST /wallets/me/sync-code",
      "GET /wallets/me",
      "DELETE /wallets/me",
      "GET /wallets/me/bonds",
      "PUT /wallets/me/bonds",
      "DELETE /wallets/me/bonds/{denomination}/{number}",
      "POST /wallets/me/bonds/import",
      "GET /wallets/me/matches",
      "POST /wallets/me/matches/seen",
      "GET /wallets/me/analytics",
      "POST /wallets/me/push",
      "DELETE /wallets/me/push",
      "GET /app/latest",
      "GET /cron/{job}",
      "POST /cron/{job}",
      "GET /health",
    ]) {
      expect(keys).toContain(expected);
    }
  });

  it("caps check requests at 1000 expanded numbers", () => {
    expect(checkRequestSchema.safeParse({ items: [{ from: "000001", to: "001000" }] }).success).toBe(true);
    expect(checkRequestSchema.safeParse({ items: [{ from: "000001", to: "001001" }] }).success).toBe(false);
    expect(checkRequestSchema.safeParse({ items: [{ number: "12345" }] }).success).toBe(false);
    expect(checkRequestSchema.safeParse({ items: [{ number: "123456", from: "000001", to: "000002" }] }).success).toBe(false);
  });
});

describe("ApiClient", () => {
  it("builds paths and sends typed requests", async () => {
    expect(buildPath("/bonds/draws/{denomination}/{drawNumber}", { denomination: "25000P", drawNumber: 3 })).toBe(
      "/bonds/draws/25000P/3",
    );
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const client = new ApiClient({
      baseUrl: "https://example.test/",
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const r = await client.call(listDenominations);
    expect(r.data).toEqual([]);
    expect(calls[0]?.url).toBe("https://example.test/api/v1/bonds/denominations");
    await client.call(checkBonds, { body: { items: [{ number: "123456" }] } }).catch(() => undefined);
    expect(calls[1]?.init?.method).toBe("POST");
    expect(client.url(getDraw, { params: { denomination: "750", drawNumber: 12 } })).toBe(
      "https://example.test/api/v1/bonds/draws/750/12",
    );
  });

  it("maps error bodies to ApiError", async () => {
    const client = new ApiClient({
      fetch: (async () =>
        new Response(JSON.stringify({ error: { code: "not_implemented", message: "soon" } }), {
          status: 501,
        })) as unknown as typeof fetch,
    });
    await expect(client.call(listDenominations)).rejects.toMatchObject({
      code: "not_implemented",
      status: 501,
    });
    await expect(client.call(listDenominations)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("bond numbers", () => {
  it("pads to six digits and expands ranges", () => {
    expect(formatBondNumber(42)).toBe("000042");
    expect(() => formatBondNumber(1_000_000)).toThrow();
    expect(expandRange("000001", "000003", 10)).toEqual(["000001", "000002", "000003"]);
    expect(() => expandRange("000001", "002000", 1000)).toThrow();
  });
});

describe("units and decimals", () => {
  it("derives a 24K PKR tola price from spot", () => {
    const price = priceFromSpot({
      usdPerOunce: 2000,
      fxLocalPerUsd: 280,
      unit: "tola",
      purity: derivationPurity(24),
    });
    const expected = (2000 / 31.1034768) * 280 * 0.999 * GRAMS_PER_TOLA;
    expect(Math.abs(price - expected) / expected).toBeLessThan(0.0001);
  });

  it("converts unit prices", () => {
    expect(convertUnitPrice(10, "g", "10g")).toBeCloseTo(100);
  });

  it("does fixed point math without float drift", () => {
    expect(decimalToScaled("1.5")).toBe(1_500_000_000_000n);
    expect(mulDecimal("0.1", "0.2")).toBe("0.02000000");
    expect(divDecimal("1", "3", 4)).toBe("0.3333");
  });
});

describe("ids and wallet credentials", () => {
  it("generates ordered UUIDv7 values", () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });

  it("round trips the Authorization header and reads cookies", () => {
    const creds = { walletId: uuidv7(), token: "A".repeat(43) };
    const header = formatWalletAuthHeader(creds);
    expect(parseWalletAuthHeader(header)).toEqual(creds);
    expect(parseWalletAuthHeader("Bearer x")).toBeNull();
    expect(readWalletCredentials({ cookie: `${creds.walletId}.${creds.token}` })).toEqual(creds);
  });
});

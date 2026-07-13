import { describe, expect, it } from "vitest";
import { syncCodeSchema } from "../api/wallets";
import { parseWalletAuthHeader, formatWalletAuthHeader } from "../wallet-auth";
import {
  CROCKFORD_ALPHABET,
  SYNC_CODE_BITS,
  base64UrlDecode,
  base64UrlEncode,
  classifyNearMiss,
  expectedValuePerBond,
  expectedValuePerDraw,
  extractBondNumbers,
  parseBondHoldings,
  faceValueTotal,
  findNearMisses,
  formatSyncCode,
  generateSyncCode,
  generateWalletToken,
  hashClientAddress,
  hashSyncCode,
  hashWalletToken,
  hmacSha256Hex,
  normalizeDenomination,
  normalizeSyncCode,
  oneDigitNeighbours,
  parseBondList,
  parseCsv,
  parseSheetRows,
  summarizeWins,
  timingSafeEqualHex,
} from "./index";

const PEPPER = "test-pepper-not-a-real-secret-0123456789";

describe("sync codes", () => {
  it("are 12 Crockford characters that the contract accepts", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateSyncCode();
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
      expect(syncCodeSchema.parse(code)).toBe(code);
    }
    expect(SYNC_CODE_BITS).toBe(60);
  });

  it("carry 60 bits: every character is uniformly used and all 12 positions vary", () => {
    const counts = new Map<string, number>();
    const positions = Array.from({ length: 12 }, () => new Set<string>());
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const code = generateSyncCode();
      [...code].forEach((ch, p) => {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
        positions[p]!.add(ch);
      });
    }
    // 48,000 characters over 32 symbols: 1,500 expected each; allow a wide statistical margin.
    for (const ch of CROCKFORD_ALPHABET) {
      expect(counts.get(ch) ?? 0).toBeGreaterThan(1200);
      expect(counts.get(ch) ?? 0).toBeLessThan(1800);
    }
    // The top character only carries 5 bits too, so it must reach the whole alphabet.
    for (const set of positions) expect(set.size).toBe(32);
  });

  it("is deterministic for a fixed random source", () => {
    const zeros = generateSyncCode((b) => b.fill(0));
    const ones = generateSyncCode((b) => b.fill(255));
    expect(zeros).toBe("000000000000");
    expect(ones).toBe("ZZZZZZZZZZZZ");
  });

  it("normalises what people type", () => {
    expect(normalizeSyncCode("abcd-efgh-jkmn")).toBe("ABCDEFGHJKMN");
    expect(normalizeSyncCode(" 0O1I L234 5678 ")).toBe("001112345678");
    expect(normalizeSyncCode("ABCD-EFGH-JKM")).toBeNull();
    expect(normalizeSyncCode("ABCD-EFGH-JKMU")).toBeNull();
    expect(formatSyncCode("abcdefghjkmn")).toBe("ABCD-EFGH-JKMN");
  });
});

describe("wallet tokens and hashing", () => {
  it("tokens are 32 random bytes in base64url that the credential header accepts", () => {
    const token = generateWalletToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(base64UrlDecode(token)).toHaveLength(32);
    expect(generateWalletToken()).not.toBe(token);
    const walletId = "01890a5d-ac96-7b4e-8f3a-123456789abc";
    expect(parseWalletAuthHeader(formatWalletAuthHeader({ walletId, token }))).toEqual({ walletId, token });
  });

  it("base64url round trips", () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
  });

  it("HMAC-SHA256 matches the RFC 4231 test case 2", async () => {
    expect(await hmacSha256Hex("Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  it("hashes are keyed, purpose separated and stable", async () => {
    const token = generateWalletToken();
    const a = await hashWalletToken(PEPPER, token);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashWalletToken(PEPPER, token)).toBe(a);
    expect(await hashWalletToken(`${PEPPER}x`, token)).not.toBe(a);
    const code = generateSyncCode();
    expect(await hashSyncCode(PEPPER, code)).not.toBe(await hmacSha256Hex(PEPPER, code));
    // Formatting does not change the hash.
    expect(await hashSyncCode(PEPPER, formatSyncCode(code).toLowerCase())).toBe(await hashSyncCode(PEPPER, code));
    expect(await hashClientAddress(PEPPER, "203.0.113.7")).not.toContain("203.0.113.7");
    await expect(hashSyncCode(PEPPER, "nope")).rejects.toThrow();
  });

  it("compares digests in constant time", () => {
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
    expect(timingSafeEqualHex("abcd", "abc")).toBe(false);
  });
});

describe("near misses", () => {
  it("classifies one digit off and last five digits", () => {
    expect(classifyNearMiss(123456, 123456)).toBeNull();
    expect(classifyNearMiss(123456, 923456)).toBe("last_five_digits");
    expect(classifyNearMiss(123456, 123446)).toBe("one_digit_off");
    expect(classifyNearMiss(123456, 123465)).toBeNull();
    expect(classifyNearMiss(1, 2)).toBe("one_digit_off");
  });

  it("has 54 neighbours", () => {
    const n = oneDigitNeighbours(123456);
    expect(n).toHaveLength(54);
    expect(new Set(n).size).toBe(54);
    expect(n.every((x) => classifyNearMiss(x, 123456) !== null)).toBe(true);
  });

  it("finds near misses in the same denomination for tiers 1 and 2 only", () => {
    const owned = [
      { denominationCode: "750", bondNumber: 123456 },
      { denominationCode: "750", bondNumber: 500000 },
      { denominationCode: "1500", bondNumber: 123457 },
    ];
    const winners = [
      { drawId: 1, drawDate: "2025-01-15", denominationCode: "750", bondNumber: 123457, tier: 1 },
      { drawId: 1, drawDate: "2025-01-15", denominationCode: "750", bondNumber: 923456, tier: 2 },
      { drawId: 1, drawDate: "2025-01-15", denominationCode: "750", bondNumber: 500001, tier: 3 },
      { drawId: 2, drawDate: "2025-04-15", denominationCode: "750", bondNumber: 500000, tier: 1 },
      { drawId: 3, drawDate: "2025-05-15", denominationCode: "200", bondNumber: 123455, tier: 1 },
    ];
    const misses = findNearMisses(owned, winners);
    expect(misses).toEqual([
      {
        bondNumber: "123456",
        denominationCode: "750",
        drawId: 1,
        drawDate: "2025-01-15",
        winningNumber: "123457",
        tier: 1,
        reason: "one_digit_off",
      },
      {
        bondNumber: "123456",
        denominationCode: "750",
        drawId: 1,
        drawDate: "2025-01-15",
        winningNumber: "923456",
        tier: 2,
        reason: "last_five_digits",
      },
    ]);
  });

  it("stays fast for big wallets", () => {
    const owned = Array.from({ length: 5000 }, (_, i) => ({ denominationCode: "750", bondNumber: i * 199 }));
    const winners = Array.from({ length: 2000 }, (_, i) => ({
      drawId: i,
      drawDate: `20${String(10 + (i % 15)).padStart(2, "0")}-01-15`,
      denominationCode: "750",
      bondNumber: (i * 7919) % 1_000_000,
      tier: 1 + (i % 2),
    }));
    const t0 = performance.now();
    const misses = findNearMisses(owned, winners, { limit: 1000 });
    expect(performance.now() - t0).toBeLessThan(500);
    expect(misses.length).toBeGreaterThan(0);
  });
});

describe("analytics math", () => {
  it("summarises wins by year and tier", () => {
    const s = summarizeWins([
      { drawDate: "2024-02-15", tier: 3, amountPkr: 9300 },
      { drawDate: "2024-11-15", tier: 3, amountPkr: 9300 },
      { drawDate: "2021-05-17", tier: 2, amountPkr: 500000 },
    ]);
    expect(s.winsCount).toBe(3);
    expect(s.winningsPkr).toBe(518600);
    expect(s.byYear).toEqual([
      { year: 2024, count: 2, amountPkr: 18600 },
      { year: 2021, count: 1, amountPkr: 500000 },
    ]);
    expect(s.byTier).toEqual([
      { tier: 2, count: 1, amountPkr: 500000 },
      { tier: 3, count: 2, amountPkr: 18600 },
    ]);
  });

  it("computes expected value per draw from the prize table", () => {
    const table = [
      { tier: 1, amountPkr: 1_500_000, winnersCount: 1 },
      { tier: 2, amountPkr: 500_000, winnersCount: 3 },
      { tier: 3, amountPkr: 9_300, winnersCount: 1_696 },
    ];
    const perBond = expectedValuePerBond(table);
    expect(perBond).toBeCloseTo((1_500_000 + 1_500_000 + 9_300 * 1_696) / 999_999, 6);
    expect(expectedValuePerDraw([{ denominationCode: "750", count: 10 }], { "750": table })).toBeCloseTo(
      perBond * 10,
      1,
    );
    expect(expectedValuePerDraw([{ denominationCode: "100", count: 10 }], {})).toBe(0);
    expect(faceValueTotal([{ denominationCode: "750", count: 2 }, { denominationCode: "x", count: 1 }], { "750": 750 })).toBe(
      1500,
    );
  });
});

describe("bond list parsing", () => {
  it("parses singles, ranges, duplicates and invalid tokens", () => {
    const r = parseBondList("123456, 123456\n000100-000103 and 99999 1234567; 200000 to 200001");
    expect(r.numbers).toEqual(["123456", "000100", "000101", "000102", "000103", "200000", "200001"]);
    expect(r.duplicates).toBe(1);
    expect(r.invalid).toEqual(["99999", "1234567"]);
    expect(r.truncated).toBe(false);
  });

  it("caps expansion", () => {
    const r = parseBondList("000000-999999", 5000);
    expect(r.numbers).toHaveLength(5000);
    expect(r.truncated).toBe(true);
  });

  it("rejects reversed ranges", () => {
    expect(parseBondList("200000-100000").invalid).toEqual(["200000-100000"]);
  });

  it("extracts six digit runs from OCR text only", () => {
    expect(extractBondNumbers("Rs.750 No 123456 date 15-01-2025 phone 03001234567 654321 123456")).toEqual([
      "123456",
      "654321",
    ]);
  });

  it("joins digits written in groups into one number, one per line", () => {
    expect(extractBondNumbers("85 40 56\n478 805\n4 7 8 8 5 3\n854063 854056\n12 34\n000 000")).toEqual([
      "854056",
      "478805",
      "478853",
      "854063",
    ]);
    // groups that add up to more or fewer than six digits are not guessed at
    expect(extractBondNumbers("12 345 6789\n12 34")).toEqual([]);
  });

  it("expands a range written in one spreadsheet cell, keeping each row's denomination and label", () => {
    const sheet = parseSheetRows([
      ["Denomination", "Bond number", "Owner"],
      ["750", "123456", "Me"],
      ["1500", "100100-100103", "Mom"],
      ["Rs 25,000 Premium", "654321", ""],
      ["200", "200005-200001", ""],
    ]);
    expect(sheet.bonds).toEqual([
      { denominationCode: "750", bondNumber: "123456", label: "Me" },
      { denominationCode: "1500", bondNumber: "100100", label: "Mom" },
      { denominationCode: "1500", bondNumber: "100101", label: "Mom" },
      { denominationCode: "1500", bondNumber: "100102", label: "Mom" },
      { denominationCode: "1500", bondNumber: "100103", label: "Mom" },
      { denominationCode: "25000P", bondNumber: "654321", label: "Mom" },
    ]);
    expect(sheet.invalidRows).toBe(1);
  });

  it("reads a written list: a denomination line covers the numbers below it, owners the same", () => {
    const parsed = parseBondHoldings(
      [
        "Rs 750",
        "041733, 098148-098149   # bought 2019",
        "Owner: Aysha",
        "280321 280324",
        "1500:",
        "160213-160215",
        "40000 Premium: 342709",
        "Owner:",
        "854063",
      ].join("\n"),
    );
    expect(parsed.bonds).toEqual([
      { denominationCode: "750", bondNumber: "041733" },
      { denominationCode: "750", bondNumber: "098148" },
      { denominationCode: "750", bondNumber: "098149" },
      { denominationCode: "750", bondNumber: "280321", label: "Aysha" },
      { denominationCode: "750", bondNumber: "280324", label: "Aysha" },
      { denominationCode: "1500", bondNumber: "160213", label: "Aysha" },
      { denominationCode: "1500", bondNumber: "160214", label: "Aysha" },
      { denominationCode: "1500", bondNumber: "160215", label: "Aysha" },
      { denominationCode: "40000P", bondNumber: "342709", label: "Aysha" },
      { denominationCode: "40000P", bondNumber: "854063" },
    ]);
  });

  it("reads a sheet written in sections: denomination once, several numbers per cell, Excel's lost zeros", () => {
    const sheet = parseSheetRows([
      ["Denomination", "Bond numbers", "Owner"],
      ["Rs 750", "", ""],
      ["", "41733", "Ammad"],
      ["", "098148-098149, 280321", ""],
      ["1500", "160213-160214", "NA"],
      ["", "381911", ""],
    ]);
    expect(sheet.bonds).toEqual([
      { denominationCode: "750", bondNumber: "041733", label: "Ammad" },
      { denominationCode: "750", bondNumber: "098148", label: "Ammad" },
      { denominationCode: "750", bondNumber: "098149", label: "Ammad" },
      { denominationCode: "750", bondNumber: "280321", label: "Ammad" },
      { denominationCode: "1500", bondNumber: "160213", label: "NA" },
      { denominationCode: "1500", bondNumber: "160214", label: "NA" },
      { denominationCode: "1500", bondNumber: "381911", label: "NA" },
    ]);
    expect(sheet.invalidRows).toBe(0);
  });

  it("normalises denominations", () => {
    expect(normalizeDenomination("Rs. 750/-")).toBe("750");
    expect(normalizeDenomination("1,500")).toBe("1500");
    expect(normalizeDenomination("40,000 Premium")).toBe("40000P");
    expect(normalizeDenomination("25000P")).toBe("25000P");
    expect(normalizeDenomination(200)).toBe("200");
    expect(normalizeDenomination("999")).toBeNull();
    expect(normalizeDenomination("")).toBeNull();
  });

  it("reads CSV with and without headers", () => {
    const withHeader = parseCsv('Denomination,Bond Number,Note\r\n750,123456,"Ammi, gift"\n750,12345,\n1500,abc,\n750,123456,dup\n');
    const parsed = parseSheetRows(withHeader);
    expect(parsed.bonds).toEqual([
      { denominationCode: "750", bondNumber: "123456", label: "Ammi, gift" },
      // a blank owner cell repeats the owner above, as in Excel
      { denominationCode: "750", bondNumber: "012345", label: "Ammi, gift" },
    ]);
    expect(parsed.invalidRows).toBe(1);
    expect(parsed.duplicates).toBe(1);

    const bare = parseSheetRows(parseCsv("123456;Rs 200\n654321;x\n"));
    expect(bare.bonds).toEqual([
      { denominationCode: "200", bondNumber: "123456" },
      { denominationCode: null, bondNumber: "654321" },
    ]);
  });
});

import { MAX_CHECK_NUMBERS } from "@bondcheck/shared";
import { expandInput, extractBondNumbers, parseBondInput, toCheckRequest, TooManyNumbersError } from "../bond-input";

describe("parseBondInput", () => {
  it("splits on spaces, commas, Urdu commas and new lines and removes duplicates", () => {
    const r = parseBondInput("123456, 654321\n123456،000017 ;999999");
    expect(r.numbers).toEqual(["123456", "654321", "000017", "999999"]);
    expect(r.invalid).toEqual([]);
    expect(r.total).toBe(4);
  });

  it("reads ranges with a hyphen, en dash or 'to', with or without spaces", () => {
    const r = parseBondInput("100000-100009\n200000 – 200001\n300010 to 300000");
    expect(r.ranges).toEqual([
      { from: "100000", to: "100009" },
      { from: "200000", to: "200001" },
      { from: "300000", to: "300010" },
    ]);
    expect(r.numbers).toEqual([]);
    expect(r.total).toBe(10 + 2 + 11);
  });

  it("reports tokens that are not six digit numbers", () => {
    const r = parseBondInput("12345 1234567 abc 654321");
    expect(r.numbers).toEqual(["654321"]);
    expect(r.invalid).toEqual(["12345", "1234567"]);
  });
});

describe("toCheckRequest", () => {
  it("builds number and range items with the chosen denomination", () => {
    const body = toCheckRequest(parseBondInput("123456 100000-100002"), "750");
    expect(body.items).toEqual([
      { denomination: "750", number: "123456" },
      { denomination: "750", from: "100000", to: "100002" },
    ]);
  });

  it("refuses input that expands past the server limit", () => {
    const parsed = parseBondInput(`000000-${String(MAX_CHECK_NUMBERS).padStart(6, "0")}`);
    expect(parsed.total).toBe(MAX_CHECK_NUMBERS + 1);
    expect(() => toCheckRequest(parsed)).toThrow(TooManyNumbersError);
  });
});

describe("expandInput", () => {
  it("expands ranges and keeps every number once", () => {
    expect(expandInput(parseBondInput("000001 000000-000002"))).toEqual(["000001", "000000", "000002"]);
  });
});

describe("extractBondNumbers (camera text)", () => {
  it("finds serials in recognised lines and ignores longer digit runs", () => {
    const lines = [
      "PRIZE BOND Rs. 750",
      "No. 482 913",
      "Serial 0O1234",
      "Helpline 0800 12345678",
      "S.No 482913",
    ];
    expect(extractBondNumbers(lines)).toEqual(["482913", "001234"]);
  });
});

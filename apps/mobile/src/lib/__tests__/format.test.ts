import { daysUntil, formatBytes, formatDate, formatPkr, groupDigits } from "../format";

describe("format", () => {
  it("groups digits with Western numerals", () => {
    expect(groupDigits(1500000)).toBe("1,500,000");
    expect(groupDigits(284.5, 2)).toBe("284.50");
    expect(groupDigits(-1234)).toBe("-1,234");
  });

  it("formats rupees per locale without changing the digits", () => {
    expect(formatPkr(1500000, "en")).toBe("Rs 1,500,000");
    expect(formatPkr(1500000, "ur")).toBe("1,500,000 روپے");
  });

  it("formats ISO dates with month names", () => {
    expect(formatDate("2026-03-15", "en")).toBe("15 Mar 2026");
    expect(formatDate("2026-03-15", "ur")).toBe("15 مارچ 2026");
    expect(formatDate("not a date", "en")).toBe("not a date");
  });

  it("formats sizes and day distances", () => {
    expect(formatBytes(31_457_280)).toBe("30.0 MB");
    expect(formatBytes(null)).toBeNull();
    expect(daysUntil("2026-05-12", new Date(2026, 4, 10, 23, 0))).toBe(2);
  });
});

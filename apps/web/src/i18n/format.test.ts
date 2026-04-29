import { describe, expect, it } from "vitest";
import { formatAmount, formatDate, intlLocale } from "./format";

describe("format", () => {
  it("keeps Western digits in Urdu", () => {
    expect(intlLocale("ur")).toBe("ur-PK-u-nu-latn");
    expect(formatAmount("ur", 437836)).toMatch(/^[\d,]+$/);
    expect(formatAmount("en", 437836)).toBe("437,836");
    expect(formatDate("ur", "2026-10-15")).toMatch(/2026/);
    expect(formatDate("ur", "2026-10-15")).not.toMatch(/[۰-۹٠-٩]/);
  });

  it("reads plain dates as calendar dates, not shifted by time zone", () => {
    expect(formatDate("en", "2026-01-01", "long")).toBe("1 January 2026");
  });

  it("returns the input for invalid dates", () => {
    expect(formatDate("en", "not-a-date")).toBe("not-a-date");
  });
});

import { describe, expect, it } from "vitest";
import { hasPairPage, pairPageSlugs, parsePair } from "./slugs";

describe("pair pages", () => {
  it("exist both ways for every rupee currency the site links to", () => {
    for (const c of ["USD", "EUR", "INR", "THB", "SGD"]) {
      expect(hasPairPage(c, "PKR")).toBe(true);
      expect(hasPairPage("PKR", c)).toBe(true);
    }
  });

  it("do not exist for pairs without the rupee or outside the list", () => {
    expect(hasPairPage("USD", "EUR")).toBe(false);
    expect(hasPairPage("ZAR", "PKR")).toBe(false);
  });

  it("are all valid pair slugs, with no duplicates", () => {
    const slugs = pairPageSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(parsePair(s)).toBeDefined();
  });
});

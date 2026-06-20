import { describe, expect, it } from "vitest";
import { canonicalList, clusterCandidates, decideDraw } from "./reconcile";
import type { Candidate } from "./types";

const seq = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i * 7);
const third = seq(100_000, 1696);

function cand(kind: Candidate["kind"], sha: string, tiers: Candidate["tiers"], extra: Partial<Candidate> = {}): Candidate {
  return { kind, documentSha256: sha, parserVersion: "test", denominationCode: "750", drawDate: "2015-01-15", drawNumber: 61, city: "Lahore", tiers, prizes: {}, ...extra };
}

describe("decideDraw", () => {
  it("verifies when two independent families agree, and records each source's role", async () => {
    const d = await decideDraw(
      [
        cand("legacy_pkprizebond", "a", { 1: [11], 2: [21, 22, 23], 3: third }),
        cand("prizeinfo_record", "b", { 1: [11], 2: [23, 22, 21] }),
      ],
      "2026-01-01",
    );
    expect(d).toMatchObject({ status: "verified", completeness: "full", drawNumber: 61, city: "Lahore" });
    expect(d.results).toHaveLength(1700);
    expect(d.sources.map((s) => s.role)).toEqual(["primary", "corroborating"]);
  });

  it("does not verify on two sources of the same family", async () => {
    const d = await decideDraw(
      [cand("legacy_prizeinfo", "a", { 1: [11], 2: [21, 22, 23] }), cand("prizeinfo_record", "b", { 1: [11], 2: [21, 22, 23] })],
      "2026-01-01",
    );
    expect(d).toMatchObject({ status: "published", completeness: "top" });
  });

  it("marks a draw disputed when valid sources disagree on the first prize, keeping the higher precedence list", async () => {
    const d = await decideDraw(
      [cand("legacy_pkprizebond", "a", { 1: [11], 2: [21, 22, 23] }), cand("prizeinfo_record", "b", { 1: [12], 2: [21, 22, 23] })],
      "2026-01-01",
    );
    expect(d.status).toBe("disputed");
    expect(d.results.filter((r) => r.tier === 1).map((r) => r.bondNumber)).toEqual([11]);
    expect(d.sources.find((s) => s.documentSha256 === "b")?.role).toBe("conflicting");
    expect(d.issues.some((i) => i.severity === "error" && /tier 1 conflict/.test(i.message))).toBe(true);
  });

  it("moves mislabelled third prizes out of tier 2 when that is provably what happened", async () => {
    const d = await decideDraw(
      [
        cand("legacy_pkprizebond", "a", { 1: [11], 2: [21, 22, 23, 98, 99], 3: third.slice(0, 1694) }),
        cand("prizeinfo_record", "b", { 1: [11], 2: [21, 22, 23] }),
      ],
      "2026-01-01",
    );
    expect(d).toMatchObject({ status: "verified", completeness: "full" });
    expect(d.results.filter((r) => r.tier === 3).map((r) => r.bondNumber)).toEqual(expect.arrayContaining([98, 99]));
    expect(d.issues.some((i) => /moved to tier 3/.test(i.message))).toBe(true);
  });

  it("rejects a whole list whose first prize the official search contradicts", async () => {
    const d = await decideDraw(
      [
        cand("legacy_pkprizebond", "a", { 1: [11], 2: [21, 22, 23], 3: third }),
        cand("prizeinfo_record", "b", { 1: [12], 2: [31, 32, 33] }),
        cand("official_spot", "c", {}, { spot: [{ number: 11, won: false, tier: null, amountPkr: null }] }),
        cand("official_spot", "d", {}, { spot: [{ number: 12, won: true, tier: 1, amountPkr: 1_500_000 }] }),
      ],
      "2026-01-01",
    );
    expect(d).toMatchObject({ status: "verified", completeness: "top" });
    expect(d.results.filter((r) => r.tier === 1).map((r) => r.bondNumber)).toEqual([12]);
    expect(d.sources.find((s) => s.documentSha256 === "a")?.role).toBe("conflicting");
  });

  it("trusts an official file alone for draws since 2019, using the prize amounts it prints", async () => {
    const d = await decideDraw(
      [
        cand("official_txt", "a", { 1: [11], 2: [21, 22, 23], 3: third }, {
          drawDate: "2024-01-15",
          prizes: { 1: { amountPkr: 1_500_000, count: null }, 2: { amountPkr: 500_000, count: 3 }, 3: { amountPkr: 9_300, count: 1696 } },
        }),
      ],
      "2026-01-01",
    );
    expect(d).toMatchObject({ status: "verified", completeness: "full" });
    expect(d.prizes).toEqual([
      { tier: 1, amountPkr: 1_500_000, winnersCount: 1, inferred: false },
      { tier: 2, amountPkr: 500_000, winnersCount: 3, inferred: false },
      { tier: 3, amountPkr: 9_300, winnersCount: 1696, inferred: false },
    ]);
  });

  it("never invents prize amounts for old draws without a stated or referenced table", async () => {
    const d = await decideDraw([cand("legacy_pkprizebond", "a", { 1: [11], 2: [21, 22, 23], 3: third }, { drawDate: "2005-01-15" })], "2026-01-01");
    expect(d.completeness).toBe("full");
    expect(d.prizes).toEqual([]);
  });

  it("publishes nothing when the second prize list is not valid, and schedules future draws", async () => {
    const past = await decideDraw([cand("prizeinfo_record", "a", { 1: [11], 2: [21] })], "2026-01-01");
    expect(past).toMatchObject({ status: "published", completeness: "none", results: [], checksum: null });
    const future = await decideDraw([cand("prizeinfo_schedule", "b", {}, { drawDate: "2026-04-15" })], "2026-01-01");
    expect(future.status).toBe("scheduled");
  });

  it("checksums the canonical sorted tier:number list", () => {
    expect(canonicalList({ 2: [5, 3], 1: [42] })).toBe("1:000042\n2:000003\n2:000005\n");
  });
});

describe("clusterCandidates", () => {
  it("joins dates a few days apart and rejects dates only the legacy snapshot knows", () => {
    const { clusters, rejected } = clusterCandidates([
      cand("legacy_pkprizebond", "a", {}, { drawDate: "2017-12-01" }),
      cand("official_catalog", "b", {}, { drawDate: "2017-12-04" }),
      cand("legacy_pkprizebond", "c", {}, { drawDate: "2018-04-17" }),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.candidates.map((c) => c.documentSha256)).toEqual(["a", "b"]);
    expect(rejected).toHaveLength(1);
  });
});

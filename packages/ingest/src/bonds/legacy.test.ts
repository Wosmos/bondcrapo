import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@bondcheck/db/testing";
import { fixtureText, loadLegacySample } from "./fixtures";
import {
  buildLegacyDrafts,
  findLegacyArtefacts,
  legacyCandidate,
  legacyDenominationCode,
  legacyDocumentBody,
  readLegacyRows,
  type LegacyDraft,
} from "./legacy";
import { parseResultText } from "./parse-result-text";
import { checkCandidate } from "./validate";

let t: TestDb;
let drafts: LegacyDraft[];
const find = (origin: string, code: string, date: string) =>
  drafts.find((d) => d.origin === origin && d.denominationCode === code && d.drawDate === date);

beforeAll(async () => {
  t = await createTestDb();
  await loadLegacySample(t.db);
  const artefacts = await findLegacyArtefacts(t.db, "legacy_winners");
  const rows = [];
  for (const source of ["pkprizebond_com", "prizeinfo_net"]) {
    for (const d of [100, 200, 750, 1500, 25000, 40000]) rows.push(...(await readLegacyRows(t.db, "legacy_winners", source, d)));
  }
  drafts = buildLegacyDrafts(rows, artefacts);
});

describe("legacy snapshot import", () => {
  it("finds the 25 repeated pkprizebond numbers and the repeated prizeinfo first prize 003542", async () => {
    const artefacts = await findLegacyArtefacts(t.db, "legacy_winners");
    expect(artefacts.get("pkprizebond_com")?.size).toBe(25);
    expect([...(artefacts.get("prizeinfo_net") ?? [])]).toEqual([3542]);
  });

  it("splits Premium 25000 and 40000 draws out of the bearer codes by date", () => {
    expect(legacyDenominationCode(40000, "2022-03-10")).toBe("40000P");
    expect(legacyDenominationCode(40000, "2017-03-01")).toBe("40000");
    expect(legacyDenominationCode(25000, "2022-03-10")).toBe("25000P");
    expect(legacyDenominationCode(25000, "2020-11-02")).toBe("25000");
    expect(find("pkprizebond_com", "25000P", "2022-03-10")).toBeDefined();
    expect(find("pkprizebond_com", "40000", "2022-03-10")).toBeUndefined();
  });

  it("merges both date spellings of one draw into one draft", () => {
    const d = find("prizeinfo_net", "750", "2026-01-15")!;
    expect(drafts.filter((x) => x.origin === "prizeinfo_net" && x.denominationCode === "750" && x.drawDate === "2026-01-15")).toHaveLength(1);
    expect(d.tiers[1]).toEqual([809258]);
    expect(d.removedArtefacts).toEqual([3542]);
  });

  it("after cleaning, pkprizebond lists equal the official files exactly", () => {
    const pairs: [string, string, string][] = [
      ["100", "2023-05-15", "2024_11_15-05-2023-Rs-100.txt"],
      ["200", "2022-06-15", "2024_11_15-06-2022-Rs-200.txt"],
      ["1500", "2021-11-16", "2024_11_15-11-2021-Rs-1500.txt"],
    ];
    for (const [code, date, file] of pairs) {
      const d = find("pkprizebond_com", code, date)!;
      expect(d.removedArtefacts).toHaveLength(25);
      const official = parseResultText(fixtureText(`savings_gov_pk/files/${file}`));
      for (const tier of [1, 2, 3] as const) expect(d.tiers[tier]).toEqual([...official.tiers[tier].numbers].sort((a, b) => a - b));
    }
  });

  it("stores a deterministic body that parses back into a candidate", async () => {
    const d = find("pkprizebond_com", "750", "2002-10-15")!;
    const body = legacyDocumentBody(d);
    expect(legacyDocumentBody(d)).toBe(body);
    const c = legacyCandidate(body, "x".repeat(64))!;
    expect(c).toMatchObject({ kind: "legacy_pkprizebond", denominationCode: "750", drawDate: "2002-10-15", drawNumber: 12, city: "Lahore" });
    // This list carries five "second prizes"; the reference count is three, so tier 2 fails validation.
    expect(c.tiers[2]).toHaveLength(5);
    expect(checkCandidate(c).tiers[2]).toMatchObject({ valid: false, expected: 3, actual: 5 });
  });

  it("keeps truncated lists but they fail validation (the 25 row pkprizebond stubs are artefacts only)", () => {
    const stub = find("pkprizebond_com", "750", "2019-01-15");
    expect(stub === undefined || (stub.tiers[1].length === 0 && stub.tiers[3].length === 0)).toBe(true);
  });
});

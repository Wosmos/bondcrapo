import { and, eq, sql } from "drizzle-orm";
import { denominations, prizeStructures, type Db } from "@bondcheck/db";
import type { DenominationCode } from "@bondcheck/shared";
import type { Tier } from "./types";

/**
 * Reference data for prize bonds. Every value is taken from a document cited next to it; nothing
 * is assumed. Dates of first and last draws come from the official draw date list
 * (https://www.savings.gov.pk/latest/results.php, `ajaxData.php`) and the prizeinfo.net first and
 * second prize records (https://www.prizeinfo.net/<denomination>-prize-bond-first-second-record/),
 * both captured under packages/ingest/fixtures/bonds.
 */
export interface DenominationSeed {
  code: DenominationCode;
  faceValue: number;
  kind: "bearer" | "premium_registered";
  status: "active" | "discontinued";
  introducedOn: string | null;
  discontinuedOn: string | null;
  encashmentDeadline: string | null;
  drawsPerYear: number;
  notesEn: string;
  notesUr: string;
}

export const DENOMINATION_SEED: readonly DenominationSeed[] = [
  {
    code: "100",
    faceValue: 100,
    kind: "bearer",
    status: "active",
    // First draw 15-02-2013 (prizeinfo.net record, draw no. 1); official draw files call it the
    // Student Welfare Prize Bond (e.g. savings.gov.pk/wp-content/uploads/2024/11/15-02-2019-Rs-100.txt).
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    notesEn: "Student Welfare Prize Bond. Draws are held in February, May, August and November.",
    notesUr: "اسٹوڈنٹ ویلفیئر پرائز بانڈ۔ قرعہ اندازی فروری، مئی، اگست اور نومبر میں ہوتی ہے۔",
  },
  {
    code: "200",
    faceValue: 200,
    kind: "bearer",
    status: "active",
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    notesEn: "Draws are held in March, June, September and December. Five second prizes per draw.",
    notesUr: "قرعہ اندازی مارچ، جون، ستمبر اور دسمبر میں ہوتی ہے۔ ہر قرعہ اندازی میں پانچ دوسرے انعامات ہوتے ہیں۔",
  },
  {
    code: "750",
    faceValue: 750,
    kind: "bearer",
    status: "active",
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    notesEn: "Draws are held in January, April, July and October.",
    notesUr: "قرعہ اندازی جنوری، اپریل، جولائی اور اکتوبر میں ہوتی ہے۔",
  },
  {
    code: "1500",
    faceValue: 1500,
    kind: "bearer",
    status: "active",
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    notesEn: "Draws are held in February, May, August and November.",
    notesUr: "قرعہ اندازی فروری، مئی، اگست اور نومبر میں ہوتی ہے۔",
  },
  {
    code: "7500",
    faceValue: 7500,
    kind: "bearer",
    status: "discontinued",
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    // Last draw 01-02-2021, Lahore (prizeinfo.net record).
    notesEn: "Bearer bond withdrawn from circulation. The last draw was held on 1 February 2021.",
    notesUr: "یہ بانڈ واپس لے لیا گیا ہے۔ آخری قرعہ اندازی یکم فروری 2021 کو ہوئی۔",
  },
  {
    code: "15000",
    faceValue: 15000,
    kind: "bearer",
    status: "discontinued",
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    // Last draw 01-04-2021, Hyderabad (prizeinfo.net record).
    notesEn: "Bearer bond withdrawn from circulation. The last draw was held on 1 April 2021.",
    notesUr: "یہ بانڈ واپس لے لیا گیا ہے۔ آخری قرعہ اندازی یکم اپریل 2021 کو ہوئی۔",
  },
  {
    code: "25000",
    faceValue: 25000,
    kind: "bearer",
    status: "discontinued",
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    // First draw 02-05-2012, last draw 02-11-2020 (prizeinfo.net record).
    notesEn: "Bearer bond withdrawn from circulation. The last draw was held on 2 November 2020. Not to be confused with the Rs 25,000 Premium Prize Bond (registered).",
    notesUr: "یہ بانڈ واپس لے لیا گیا ہے۔ آخری قرعہ اندازی 2 نومبر 2020 کو ہوئی۔ اسے 25,000 روپے کے پریمیم (رجسٹرڈ) بانڈ سے الگ سمجھیں۔",
  },
  {
    code: "40000",
    faceValue: 40000,
    kind: "bearer",
    status: "discontinued",
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    // Last draw 03-06-2019, Faisalabad (official date list ajaxData.php id=8, prizeinfo.net record).
    notesEn: "Bearer bond withdrawn from circulation. The last draw was held on 3 June 2019. Not to be confused with the Rs 40,000 Premium Prize Bond (registered).",
    notesUr: "یہ بانڈ واپس لے لیا گیا ہے۔ آخری قرعہ اندازی 3 جون 2019 کو ہوئی۔ اسے 40,000 روپے کے پریمیم (رجسٹرڈ) بانڈ سے الگ سمجھیں۔",
  },
  {
    code: "25000P",
    faceValue: 25000,
    kind: "premium_registered",
    status: "active",
    // First draw 10-03-2021, Multan, "Draw No. 1st" (savings.gov.pk/wp-content/uploads/2024/11/10-03-2021-Rs-25000-Premium.txt).
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    notesEn: "Registered premium bond. Draws on the 10th of March, June, September and December. Two first prizes per draw.",
    notesUr: "رجسٹرڈ پریمیم بانڈ۔ قرعہ اندازی مارچ، جون، ستمبر اور دسمبر کی 10 تاریخ کو ہوتی ہے۔ ہر قرعہ اندازی میں دو پہلے انعامات ہوتے ہیں۔",
  },
  {
    code: "40000P",
    faceValue: 40000,
    kind: "premium_registered",
    status: "active",
    // First draw 12-06-2017, Peshawar (official date list ajaxData.php id=9, prizeinfo.net record).
    introducedOn: null,
    discontinuedOn: null,
    encashmentDeadline: null,
    drawsPerYear: 4,
    notesEn: "Registered premium bond. Draws on the 10th of March, June, September and December.",
    notesUr: "رجسٹرڈ پریمیم بانڈ۔ قرعہ اندازی مارچ، جون، ستمبر اور دسمبر کی 10 تاریخ کو ہوتی ہے۔",
  },
];

export interface PrizeStructureSeed {
  denominationCode: DenominationCode;
  effectiveFrom: string;
  effectiveTo: string | null;
  tier: Tier;
  amountPkr: number;
  winnersCount: number;
  sourceUrl: string;
}

const U = "https://savings.gov.pk/wp-content/uploads";

/**
 * Prize tables as printed in official result files. `effectiveFrom` is the earliest official
 * document in hand that states the value, not the date the value was introduced: earlier draws
 * have no reference and their amounts are shown only when their own document states them.
 */
export const PRIZE_STRUCTURE_SEED: readonly PrizeStructureSeed[] = [
  ...tiers("100", "2019-02-15", `${U}/2024/11/15-02-2019-Rs-100.txt`, [700_000, 1], [200_000, 3], [1_000, 1199]),
  ...tiers("200", "2021-03-15", `${U}/2024/11/15-03-2021-Rs-200-1.txt`, [750_000, 1], [250_000, 5], [1_250, 2394]),
  ...tiers("750", "2019-01-15", `${U}/2024/11/15-01-2019-Rs-750.txt`, [1_500_000, 1], [500_000, 3], [9_300, 1696]),
  ...tiers("1500", "2019-02-15", `${U}/2024/11/15-02-2019-Rs-1500.txt`, [3_000_000, 1], [1_000_000, 3], [18_500, 1696]),
  ...tiers("25000P", "2021-03-10", `${U}/2024/11/10-03-2021-Rs-25000-Premium.txt`, [30_000_000, 2], [10_000_000, 5], [300_000, 700]),
  ...tiers("40000P", "2019-03-11", `${U}/2024/11/11-03-2019-Rs-40000-premium.txt`, [80_000_000, 1], [30_000_000, 3], [500_000, 660]),
  {
    // Official number search for the 53rd draw (01-03-2013, Hyderabad): "First 058371 75,000,000".
    denominationCode: "40000",
    effectiveFrom: "2013-03-01",
    effectiveTo: "2019-06-03",
    tier: 1,
    amountPkr: 75_000_000,
    winnersCount: 1,
    sourceUrl: "https://www.savings.gov.pk/latest/results.php#country=8&state=155&date=2013-03-01&number=058371",
  },
];

function tiers(
  code: DenominationCode,
  from: string,
  url: string,
  ...rows: [amount: number, count: number][]
): PrizeStructureSeed[] {
  return rows.map(([amountPkr, winnersCount], i) => ({
    denominationCode: code,
    effectiveFrom: from,
    effectiveTo: null,
    tier: (i + 1) as Tier,
    amountPkr,
    winnersCount,
    sourceUrl: url,
  }));
}

/**
 * Winning numbers per series by tier. Each official file states these counts; for draws whose
 * document has no header (the legacy snapshot) they are the reference for validation rule 2.
 * They match the official files listed in PRIZE_STRUCTURE_SEED, and every full list in the legacy
 * snapshot (after removing scraper artefacts) since 2000 has exactly these totals.
 */
export const SERIES_COUNTS: Record<DenominationCode, Record<Tier, number>> = {
  "100": { 1: 1, 2: 3, 3: 1199 },
  "200": { 1: 1, 2: 5, 3: 2394 },
  "750": { 1: 1, 2: 3, 3: 1696 },
  "1500": { 1: 1, 2: 3, 3: 1696 },
  "7500": { 1: 1, 2: 3, 3: 1696 },
  "15000": { 1: 1, 2: 3, 3: 1696 },
  "25000": { 1: 1, 2: 3, 3: 1696 },
  "40000": { 1: 1, 2: 3, 3: 1696 },
  "25000P": { 1: 2, 2: 5, 3: 700 },
  "40000P": { 1: 1, 2: 3, 3: 660 },
};

/** The prize table effective on a date, per tier (undefined when no document states one). */
export function structureOn(code: DenominationCode, date: string): Partial<Record<Tier, PrizeStructureSeed>> {
  const out: Partial<Record<Tier, PrizeStructureSeed>> = {};
  for (const s of PRIZE_STRUCTURE_SEED) {
    if (s.denominationCode !== code || date < s.effectiveFrom) continue;
    if (s.effectiveTo !== null && date > s.effectiveTo) continue;
    const current = out[s.tier];
    if (!current || current.effectiveFrom < s.effectiveFrom) out[s.tier] = s;
  }
  return out;
}

/** Upserts denominations and prize structures. Returns how many rows changed. */
export async function seedBondReference(db: Db): Promise<number> {
  let changed = 0;
  for (const d of DENOMINATION_SEED) {
    const res = await db
      .insert(denominations)
      .values(d)
      .onConflictDoUpdate({
        target: denominations.code,
        set: {
          faceValue: d.faceValue,
          kind: d.kind,
          status: d.status,
          introducedOn: d.introducedOn,
          discontinuedOn: d.discontinuedOn,
          encashmentDeadline: d.encashmentDeadline,
          drawsPerYear: d.drawsPerYear,
          notesEn: d.notesEn,
          notesUr: d.notesUr,
        },
        setWhere: sql`(${denominations.notesEn}, ${denominations.notesUr}, ${denominations.status}, ${denominations.kind}) is distinct from (${d.notesEn}, ${d.notesUr}, ${d.status}, ${d.kind})`,
      })
      .returning({ code: denominations.code });
    changed += res.length;
  }
  for (const s of PRIZE_STRUCTURE_SEED) {
    const [existing] = await db
      .select()
      .from(prizeStructures)
      .where(
        and(
          eq(prizeStructures.denominationCode, s.denominationCode),
          eq(prizeStructures.effectiveFrom, s.effectiveFrom),
          eq(prizeStructures.tier, s.tier),
        ),
      );
    if (!existing) {
      await db.insert(prizeStructures).values(s);
      changed++;
    } else if (
      existing.amountPkr !== s.amountPkr ||
      existing.winnersCount !== s.winnersCount ||
      existing.sourceUrl !== s.sourceUrl ||
      existing.effectiveTo !== s.effectiveTo
    ) {
      await db
        .update(prizeStructures)
        .set({ amountPkr: s.amountPkr, winnersCount: s.winnersCount, sourceUrl: s.sourceUrl, effectiveTo: s.effectiveTo })
        .where(eq(prizeStructures.id, existing.id));
      changed++;
    }
  }
  return changed;
}

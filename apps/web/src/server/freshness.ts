import "server-only";
import { unstable_cache } from "next/cache";
import { bondsFreshness } from "@bondcheck/db/queries/bonds";
import { marketsFreshness } from "@bondcheck/db/queries/markets";
import { MARKETS_TAG } from "@/platform/revalidate";
import { getDb } from "./db";

/** One row of the "what comes from where" table on /about/data. */
export interface DatasetFreshness {
  id: "bonds" | "pkReported" | "estimates" | "spot" | "openMarket" | "interbank" | "fx";
  /** Market source ids (registry in @bondcheck/ingest/markets/sources) or bond source ids (common.data.sources). */
  sources: string[];
  /** Newest data point: an ISO date, or an ISO date-time for intraday data. */
  latest: string | null;
  /** Draws with results, for the bonds row. */
  count?: number;
}

/** Document sources in the database mapped onto the bond source ids named on the page. */
const BOND_SOURCE_OF: Record<string, string> = { savings_gov_pk: "nss", savings_gov_pk_legacy: "nss", prizeinfo_net: "prizeinfo" };

const maxIso = (values: (string | Date)[]): string | null =>
  values.reduce<string | null>((m, v) => {
    const s = typeof v === "string" ? v : v.toISOString();
    return !m || s > m ? s : m;
  }, null);
const unique = (ids: string[]) => [...new Set(ids)];

async function compute(): Promise<DatasetFreshness[]> {
  const db = getDb();
  const [bonds, markets] = await Promise.all([bondsFreshness(db), marketsFreshness(db)]);
  const pkr = (kind: string) => markets.pkr.filter((r) => r.kind === kind);
  const local = (kind: string) => markets.local.filter((r) => r.kind === kind);
  const reported = local("reported").filter((r) => r.country === "PK");
  return [
    {
      id: "bonds",
      // The official source first, then the cross-checks.
      sources: unique(bonds.documents.map((d) => BOND_SOURCE_OF[d.source] ?? d.source)).sort((a, b) => (a === "nss" ? -1 : b === "nss" ? 1 : 0)),
      latest: bonds.latestDrawDate,
      count: bonds.heldDraws,
    },
    { id: "pkReported", sources: unique(reported.map((r) => r.source)), latest: maxIso(reported.map((r) => r.latest)) },
    { id: "estimates", sources: ["derived"], latest: maxIso(local("derived").map((r) => r.latest)) },
    { id: "spot", sources: unique(markets.spot.map((r) => r.source)), latest: maxIso(markets.spot.map((r) => r.latest)) },
    { id: "openMarket", sources: unique(pkr("open_market").map((r) => r.source)), latest: maxIso(pkr("open_market").map((r) => r.latest)) },
    { id: "interbank", sources: unique(pkr("interbank").map((r) => r.source)), latest: maxIso(pkr("interbank").map((r) => r.latest)) },
    { id: "fx", sources: unique(markets.fx.map((r) => r.source)), latest: maxIso(markets.fx.map((r) => r.latest)) },
  ];
}

/**
 * How current each dataset is, cached like the pages that show the data and refreshed by the same
 * ingest tags. Null when the database is not configured or not reachable: the page then lists the
 * sources without dates.
 */
export async function loadFreshness(): Promise<DatasetFreshness[] | null> {
  try {
    return await unstable_cache(compute, ["data-freshness"], { tags: ["bonds", MARKETS_TAG], revalidate: 900 })();
  } catch (error) {
    console.warn(`[data] freshness unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

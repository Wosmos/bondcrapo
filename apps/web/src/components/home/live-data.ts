import type { DrawSummary } from "@bondcheck/shared/api/bonds";
import type { z } from "zod";
import type { localRateSchema, pkrRateSchema } from "@bondcheck/shared/api/markets";
import { DENOMINATIONS } from "@bondcheck/shared/constants";

/**
 * Data for the home page "Today at a glance" board. Everything comes from `/api/v1` through the
 * shared `ApiClient`, loaded with dynamic imports so zod and the contracts stay out of the
 * initial bundle. Selectors are pure and unit tested.
 */

export type LocalRate = z.infer<typeof localRateSchema>;
export type PkrRate = z.infer<typeof pkrRateSchema>;

export type Tile<T> = { state: "loading" } | { state: "error" } | { state: "empty" } | { state: "ready"; data: T };

export interface BoardData {
  latest: Tile<DrawSummary[]>;
  gold: Tile<LocalRate>;
  usd: Tile<{ open: PkrRate | null; interbank: PkrRate | null }>;
}

export const LOADING_BOARD: BoardData = { latest: { state: "loading" }, gold: { state: "loading" }, usd: { state: "loading" } };

const ORDER = new Map(DENOMINATIONS.map((d, i) => [d.code as string, (d.active ? 0 : 100) + i]));

/** Active denominations first, in face value order; at most `limit` rows. */
export function selectLatest(draws: DrawSummary[], limit = 6): DrawSummary[] {
  return draws
    .filter((d) => d.status !== "scheduled")
    .sort((a, b) => (ORDER.get(a.denominationCode) ?? 999) - (ORDER.get(b.denominationCode) ?? 999))
    .slice(0, limit);
}

/** 24K gold per tola in PKR: the newest date wins; on the same date a reported rate beats a derived one. */
export function selectGold(rates: LocalRate[]): LocalRate | null {
  const candidates = rates.filter(
    (r) => r.metal === "XAU" && r.karat === 24 && r.unit === "tola" && r.currency === "PKR",
  );
  candidates.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      Number(b.kind === "reported") - Number(a.kind === "reported") ||
      Number(a.city !== "") - Number(b.city !== ""),
  );
  return candidates[0] ?? null;
}

export function selectUsd(rates: PkrRate[]): { open: PkrRate | null; interbank: PkrRate | null } {
  const newest = (kind: PkrRate["kind"]) =>
    rates
      .filter((r) => r.currency === "USD" && r.kind === kind)
      .sort((a, b) => b.date.localeCompare(a.date) || b.observedAt.localeCompare(a.observedAt))[0] ?? null;
  return { open: newest("open_market"), interbank: newest("interbank") };
}

function tile<T>(result: PromiseSettledResult<T | null>, isEmpty: (v: T) => boolean): Tile<T> {
  if (result.status === "rejected") return { state: "error" };
  if (result.value === null || isEmpty(result.value)) return { state: "empty" };
  return { state: "ready", data: result.value };
}

export async function loadBoard(fetchImpl?: typeof fetch): Promise<BoardData> {
  const [{ ApiClient }, bonds, markets] = await Promise.all([
    import("@bondcheck/shared/client"),
    import("@bondcheck/shared/api/bonds"),
    import("@bondcheck/shared/api/markets"),
  ]);
  const api = new ApiClient({ baseUrl: "", fetch: fetchImpl });
  const [latest, gold, usd] = await Promise.allSettled([
    api.call(bonds.latestDraws).then((r) => selectLatest(r.data)),
    api.call(markets.localRates, { query: { country: "PK" } }).then((r) => selectGold(r.data)),
    api.call(markets.fxPkr, { query: {} }).then((r) => selectUsd(r.data)),
  ]);
  return {
    latest: tile(latest, (v) => v.length === 0),
    gold: tile(gold, () => false),
    usd: tile(usd, (v) => !v.open && !v.interbank),
  };
}

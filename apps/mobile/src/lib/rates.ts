import type { z } from "zod";
import type { localRateSchema, pkrRateSchema } from "@bondcheck/shared";

type LocalRate = z.infer<typeof localRateSchema>;
type PkrRate = z.infer<typeof pkrRateSchema>;

export interface KaratRow {
  metal: LocalRate["metal"];
  karat: number;
  perTola: LocalRate | null;
  per10g: LocalRate | null;
}

/** One row per metal and karat with the tola and 10 g prices side by side; reported wins over derived. */
export function rateTable(rates: readonly LocalRate[]): KaratRow[] {
  const rows = new Map<string, KaratRow>();
  const better = (a: LocalRate | null, b: LocalRate) =>
    !a || (a.kind === "derived" && b.kind === "reported") || (a.kind === b.kind && b.observedAt > a.observedAt) ? b : a;
  for (const r of rates) {
    if (r.unit !== "tola" && r.unit !== "10g") continue;
    const key = `${r.metal}:${r.karat}`;
    const row = rows.get(key) ?? { metal: r.metal, karat: r.karat, perTola: null, per10g: null };
    if (r.unit === "tola") row.perTola = better(row.perTola, r);
    else row.per10g = better(row.per10g, r);
    rows.set(key, row);
  }
  const metalOrder = ["XAU", "XAG", "XPT", "XPD"];
  return [...rows.values()].sort(
    (a, b) => metalOrder.indexOf(a.metal) - metalOrder.indexOf(b.metal) || b.karat - a.karat,
  );
}

export interface FxRow {
  currency: string;
  openMarket: PkrRate | null;
  interbank: PkrRate | null;
}

const FX_ORDER = ["USD", "SAR", "AED", "GBP", "EUR"];

export function fxTable(rates: readonly PkrRate[]): FxRow[] {
  const rows = new Map<string, FxRow>();
  for (const r of rates) {
    const row = rows.get(r.currency) ?? { currency: r.currency, openMarket: null, interbank: null };
    if (r.kind === "open_market") row.openMarket = r;
    else row.interbank = r;
    rows.set(r.currency, row);
  }
  const rank = (c: string) => (FX_ORDER.indexOf(c) === -1 ? FX_ORDER.length : FX_ORDER.indexOf(c));
  return [...rows.values()].sort((a, b) => rank(a.currency) - rank(b.currency) || a.currency.localeCompare(b.currency));
}

export function readAttribution(meta: Record<string, unknown> | undefined): { name: string; text: string }[] {
  const list = meta?.attribution;
  if (!Array.isArray(list)) return [];
  return list
    .filter((a): a is { name: string; text: string } => typeof a?.name === "string" && typeof a?.text === "string")
    .map((a) => ({ name: a.name, text: a.text }));
}

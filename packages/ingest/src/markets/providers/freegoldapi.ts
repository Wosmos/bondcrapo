import { z } from "zod";
import { ParseError } from "../types";

export const FREEGOLDAPI_URL = "https://freegoldapi.com/data/latest.json";

const rows = z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), price: z.number().positive(), source: z.string() }));

export interface MonthlyGoldPoint {
  date: string;
  priceUsdPerOz: number;
}

/**
 * FreeGoldAPI long run series. Only USD rows from `fromDate` on are kept (older rows are in GBP
 * or converted), and only the World Bank Pink Sheet monthly averages are used (the daily rows from
 * 2025 on come from a market data site whose terms do not allow reuse). The series feeds only the
 * long range chart, and only once its licence is confirmed (owner task).
 */
export function parseFreeGoldApi(json: unknown, fromDate = "2000-01-01"): MonthlyGoldPoint[] {
  const r = rows.safeParse(json);
  if (!r.success) throw new ParseError("freegoldapi", "unexpected payload");
  return r.data
    .filter((x) => x.date >= fromDate && x.source === "worldbank")
    .map((x) => ({ date: x.date, priceUsdPerOz: x.price }));
}

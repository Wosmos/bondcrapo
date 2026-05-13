import { insertMetalDaily, upsertFxDaily, type DailyRow } from "@bondcheck/db/queries/markets";
import { METALS } from "@bondcheck/shared";
import type { Job, JobResult } from "../job";
import { currencyApiUrl, parseCurrencyApiDay } from "./providers/fx";
import { FREEGOLDAPI_URL, parseFreeGoldApi } from "./providers/freegoldapi";

/**
 * One-off history backfill (CLI only, not a cron job). Daily reference FX and metal closes come
 * from the dated currency-api releases on jsDelivr (CC0), which start on 2024-03-02. Optionally,
 * monthly gold from 2000 comes from FreeGoldAPI once its licence is confirmed.
 * Nothing here overwrites a day we already hold, so it is safe to re-run.
 */
export const CURRENCY_API_FIRST_DAY = "2024-03-02";

export interface BackfillOptions {
  from: string;
  to: string;
  /** Monthly World Bank gold averages from FreeGoldAPI, before `CURRENCY_API_FIRST_DAY`. */
  goldMonthly?: boolean;
}

interface Cursor {
  next: string;
  goldMonthlyDone?: boolean;
}

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function marketsBackfillJob(options: BackfillOptions): Job {
  const from = options.from < CURRENCY_API_FIRST_DAY ? CURRENCY_API_FIRST_DAY : options.from;
  return {
    name: "markets-backfill",
    async run(ctx, rawCursor): Promise<JobResult> {
      const cursor: Cursor = isCursor(rawCursor) ? rawCursor : { next: from };
      const stats = { days: 0, fxRows: 0, metalRows: 0, missing: 0, goldMonthlyRows: 0 };

      if (options.goldMonthly && !cursor.goldMonthlyDone) {
        const res = await ctx.fetcher.get(FREEGOLDAPI_URL, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`freegoldapi HTTP ${res.status}`);
        const points = parseFreeGoldApi(JSON.parse(res.body), options.from).filter((p) => p.date < CURRENCY_API_FIRST_DAY);
        const rows: DailyRow[] = points.map((p) => ({
          metal: "XAU",
          date: p.date,
          open: p.priceUsdPerOz,
          high: p.priceUsdPerOz,
          low: p.priceUsdPerOz,
          close: p.priceUsdPerOz,
          source: "freegoldapi",
        }));
        stats.goldMonthlyRows = await insertMetalDaily(ctx.db, rows);
        cursor.goldMonthlyDone = true;
      }

      while (cursor.next <= options.to) {
        const day = cursor.next;
        const res = await ctx.fetcher.get(currencyApiUrl(day), { headers: { Accept: "application/json" } });
        if (res.status === 404) {
          stats.missing++;
          await ctx.issue({ severity: "info", entity: "currency-api", entityKey: day, message: "no release for this day" });
        } else if (!res.ok) {
          throw new Error(`currency-api ${day}: HTTP ${res.status}`);
        } else {
          const parsed = parseCurrencyApiDay(JSON.parse(res.body));
          stats.fxRows += await upsertFxDaily(ctx.db, { date: parsed.date, rates: parsed.fx, source: "currency-api", overwrite: false });
          const metals: DailyRow[] = METALS.flatMap((m) => {
            const v = parsed.metals[m];
            return v ? [{ metal: m, date: parsed.date, open: v, high: v, low: v, close: v, source: "currency-api" }] : [];
          });
          stats.metalRows += await insertMetalDaily(ctx.db, metals);
          stats.days++;
        }
        cursor.next = addDays(day, 1);
        // At least one day per chunk, so a tiny budget still makes progress.
        if (cursor.next <= options.to && ctx.shouldStop()) return { done: false, cursor, stats };
      }
      return { done: true, cursor: null, stats };
    },
  };
}

function isCursor(v: unknown): v is Cursor {
  return typeof v === "object" && v !== null && typeof (v as Cursor).next === "string";
}

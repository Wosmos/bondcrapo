/**
 * Market history backfill.
 *
 *   tsx src/markets/backfill-cli.ts [--from 2024-03-02] [--to <today>] [--gold-monthly] [--dry-run]
 *
 * Needs DATABASE_URL except with --dry-run, which downloads and parses the first three days only
 * and prints what would be written. Requests go through the polite Fetcher (one request every two
 * seconds per host), so a full run from 2024 takes roughly half an hour; it resumes where it
 * stopped. --gold-monthly also loads monthly gold from 2000 (FreeGoldAPI; confirm its licence first).
 */
import { createTransactionalDb } from "@bondcheck/db";
import { Fetcher } from "../fetcher";
import { runJobToCompletion } from "../run-job";
import { CURRENCY_API_FIRST_DAY, marketsBackfillJob } from "./backfill";
import { currencyApiUrl, parseCurrencyApiDay } from "./providers/fx";

const USER_AGENT = process.env.INGEST_USER_AGENT ?? "BondCheckBot/1.0 (+https://bondcheck.invalid/about/data)";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function main(): Promise<void> {
  const from = arg("from") ?? CURRENCY_API_FIRST_DAY;
  const to = arg("to") ?? new Date().toISOString().slice(0, 10);
  if (!DATE.test(from) || !DATE.test(to) || from > to) {
    console.error("usage: backfill-cli.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--gold-monthly] [--dry-run]");
    process.exit(2);
  }
  if (process.argv.includes("--gold-monthly") && process.env.MARKETS_ALLOW_FREEGOLDAPI !== "1") {
    console.error("--gold-monthly needs MARKETS_ALLOW_FREEGOLDAPI=1 (confirm the FreeGoldAPI licence first)");
    process.exit(2);
  }
  const fetcher = new Fetcher({ userAgent: USER_AGENT });

  if (process.argv.includes("--dry-run")) {
    let day = from < CURRENCY_API_FIRST_DAY ? CURRENCY_API_FIRST_DAY : from;
    for (let i = 0; i < 3 && day <= to; i++) {
      const res = await fetcher.get(currencyApiUrl(day));
      if (res.ok) {
        const p = parseCurrencyApiDay(JSON.parse(res.body));
        console.log(JSON.stringify({ day, fxRates: Object.keys(p.fx).length, metals: p.metals, usdPkr: p.fx.PKR }));
      } else console.log(JSON.stringify({ day, status: res.status }));
      day = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    }
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required (or pass --dry-run)");
    process.exit(2);
  }
  const results = await runJobToCompletion(marketsBackfillJob({ from, to, goldMonthly: process.argv.includes("--gold-monthly") }), {
    db: createTransactionalDb(url),
    fetcher,
    trigger: "cli",
  });
  const last = results[results.length - 1];
  console.log(JSON.stringify({ chunks: results.length, last }, null, 2));
  process.exit(last?.status === "failed" ? 1 : 0);
}

void main();

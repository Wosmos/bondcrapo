import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDb, createTransactionalDb, type Db } from "@bondcheck/db";
import { DENOMINATION_CODES, type DenominationCode } from "@bondcheck/shared";
import { Fetcher } from "../fetcher";
import { runJobToCompletion } from "../run-job";
import { createBackfillJob } from "./backfill";
import { buildCoverageMarkdown } from "./coverage";
import { parseLooseDate, pktDate } from "./dates";
import { FormPoster } from "./form-post";
import { HOST_INTERVALS_MS } from "./sources";

const USAGE = `usage: bun run --cwd packages/ingest backfill:bonds [options]

  --from YYYY-MM-DD     only draws on or after this date
  --denomination CODE   repeatable: 100 200 750 1500 7500 15000 25000 40000 25000P 40000P
  --dry-run             write into a throwaway in-memory database; DATABASE_URL, when set,
                        is only read (legacy snapshot), never written
  --offline             do not fetch from the official site or prizeinfo.net
  --no-legacy           skip the legacy snapshot import
  --coverage            write docs/COVERAGE.md when finished
  --spot-budget N       maximum official number searches (default 40)
`;

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const out = { from: undefined as string | undefined, denominations: [] as DenominationCode[], dryRun: false, offline: false, legacy: true, coverage: false, spotBudget: 40 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const value = () => argv[++i] ?? fail(`${a} needs a value`);
    if (a === "--from") {
      const iso = parseLooseDate(value());
      if (!iso) fail("--from expects a date like 2024-01-01");
      out.from = iso;
    } else if (a === "--denomination") {
      const code = value();
      if (!(DENOMINATION_CODES as readonly string[]).includes(code)) fail(`unknown denomination ${code}`);
      out.denominations.push(code as DenominationCode);
    } else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--offline") out.offline = true;
    else if (a === "--no-legacy") out.legacy = false;
    else if (a === "--coverage") out.coverage = true;
    else if (a === "--spot-budget") out.spotBudget = Number(value());
    else if (a === "--help" || a === "-h") fail("");
    else if (a !== "--") fail(`unknown option ${a}`);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  const userAgent = process.env.INGEST_USER_AGENT ?? "BondCheckBot/1.0 (+https://bondcheck.invalid/about/data)";

  let db: Db;
  let legacyDb: Db | undefined;
  let close = async () => {};
  if (args.dryRun) {
    const { createTestDb } = await import("@bondcheck/db/testing");
    const t = await createTestDb({ fresh: true });
    db = t.db;
    close = t.close;
    // Read only: the legacy snapshot is selected from, nothing is written to this database.
    legacyDb = url ? createDb(url) : undefined;
    if (!url) console.error("DATABASE_URL not set: the legacy snapshot is skipped in this dry run");
  } else {
    if (!url) fail("DATABASE_URL is required (or use --dry-run)");
    db = createTransactionalDb(url);
  }

  const job = createBackfillJob({
    from: args.from,
    denominations: args.denominations,
    network: !args.offline,
    legacy: args.legacy && (!args.dryRun || Boolean(legacyDb)),
    legacyDb,
    poster: new FormPoster({ userAgent }),
    spotBudget: args.spotBudget,
  });
  const started = Date.now();
  const chunks = await runJobToCompletion(job, {
    db,
    fetcher: new Fetcher({ userAgent, hostIntervalsMs: HOST_INTERVALS_MS }),
    trigger: "cli",
  });
  const last = chunks[chunks.length - 1];
  const totals: Record<string, number> = {};
  for (const c of chunks) {
    for (const [k, v] of Object.entries(c.stats)) if (typeof v === "number") totals[k] = (totals[k] ?? 0) + v;
  }
  console.log(JSON.stringify({ dryRun: args.dryRun, from: args.from ?? null, chunks: chunks.length, seconds: Math.round((Date.now() - started) / 1000), status: last?.status, totals }, null, 2));

  if (args.coverage && last?.status !== "failed") {
    const target = fileURLToPath(new URL("../../../../docs/COVERAGE.md", import.meta.url));
    const note = args.dryRun
      ? "This report was produced by a dry run: documents were fetched live, the legacy snapshot was read from the production database without writing, and the reconciled draws were written to a throwaway in-memory database. It shows what the backfill will publish."
      : undefined;
    writeFileSync(target, await buildCoverageMarkdown(db, pktDate(new Date()), note));
    console.log(`wrote ${target}`);
  }
  await close();
  process.exit(last?.status === "failed" ? 1 : 0);
}

void main();

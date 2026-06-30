import { createTransactionalDb } from "@bondcheck/db";
import { Fetcher } from "./fetcher";
import { cliJobs } from "./registry";
import { runJobToCompletion } from "./run-job";

const USER_AGENT = process.env.INGEST_USER_AGENT ?? "BondCheckBot/1.0 (+https://bondcheck.invalid/about/data)";

function usage(): never {
  const names = Object.keys(cliJobs);
  console.error(`usage: bun run --cwd packages/ingest ingest <job>\njobs: ${names.length ? names.join(", ") : "(none registered yet)"}`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [name] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!name) usage();
  const job = cliJobs[name];
  if (!job) usage();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(2);
  }
  const results = await runJobToCompletion(job, {
    db: createTransactionalDb(url),
    fetcher: new Fetcher({ userAgent: USER_AGENT }),
    trigger: "cli",
  });
  const last = results[results.length - 1];
  console.log(JSON.stringify({ job: name, chunks: results.length, last }, null, 2));
  process.exit(last?.status === "failed" ? 1 : 0);
}

void main();

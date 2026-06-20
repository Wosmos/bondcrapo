import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDb } from "@bondcheck/db";
import { buildCoverageMarkdown } from "./coverage";
import { pktDate } from "./dates";

/** Writes docs/COVERAGE.md from the database in DATABASE_URL (read only). */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(2);
  }
  const target = fileURLToPath(new URL("../../../../docs/COVERAGE.md", import.meta.url));
  writeFileSync(target, await buildCoverageMarkdown(createDb(url), pktDate(new Date())));
  console.log(`wrote ${target}`);
}

void main();

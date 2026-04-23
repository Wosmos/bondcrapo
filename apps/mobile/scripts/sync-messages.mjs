#!/usr/bin/env node
// Copies the website namespaces the app shares (ADR 0005) from apps/web/messages into
// src/i18n/web so both clients show the same wording. `--check` fails when a copy is stale
// (run by the test suite and CI) instead of writing.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const webMessages = path.resolve(appRoot, "../web/messages");
const LOCALES = ["en", "ur"];
const SHARED_NAMESPACES = ["common"];

const check = process.argv.includes("--check");
const stale = [];

for (const locale of LOCALES) {
  for (const ns of SHARED_NAMESPACES) {
    const source = path.join(webMessages, locale, `${ns}.json`);
    const target = path.join(appRoot, "src/i18n/web", locale, `${ns}.json`);
    const content = `${JSON.stringify(JSON.parse(readFileSync(source, "utf8")), null, 2)}\n`;
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current === content) continue;
    if (check) {
      stale.push(path.relative(appRoot, target));
    } else {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
      console.log(`updated ${path.relative(appRoot, target)}`);
    }
  }
}

if (stale.length > 0) {
  console.error(`Shared messages are out of date: ${stale.join(", ")}. Run: pnpm --filter mobile messages`);
  process.exit(1);
}

#!/usr/bin/env node
// Writes the release assets that describe an APK (ADR 0006):
//   SHA256SUMS.txt  `sha256sum` format for every file passed with --apk
//   latest.json     the update manifest read by the website and the app
//
// Usage (from the release workflow):
//   node apps/mobile/scripts/release-manifest.mjs --apk out/bondcheck-1.2.0.apk --out out \
//     --version 1.2.0 --version-code 10200 --min-supported 10000 --notes-file notes.md
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DOWNLOAD_PREFIX = "/api/v1/releases/download/";
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,199}$/;

export function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** Builds latest.json. The URL is relative: the website resolves it to its own download route. */
export function buildManifest({ apkName, sha256, size, version, versionCode, minSupportedVersionCode, notes, publishedAt }) {
  if (!SAFE_NAME.test(apkName)) throw new Error(`unsafe asset name: ${apkName}`);
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("sha256 must be 64 hex characters");
  if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error("versionCode must be a positive integer");
  const min = Math.min(minSupportedVersionCode ?? 1, versionCode);
  return {
    version,
    versionCode,
    url: `${DOWNLOAD_PREFIX}${encodeURIComponent(apkName)}`,
    sha256,
    size,
    minSupportedVersionCode: min,
    notes: (notes ?? "").trim().slice(0, 4000),
    publishedAt,
  };
}

export function checksumsText(entries) {
  return entries.map(({ name, sha256 }) => `${sha256}  ${name}`).join("\n") + "\n";
}

function arg(args, flag, fallback) {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
}

function main(argv) {
  const apk = arg(argv, "--apk");
  const out = arg(argv, "--out", ".");
  if (!apk) throw new Error("--apk is required");
  const notesFile = arg(argv, "--notes-file");
  const sha256 = sha256File(apk);
  const apkName = path.basename(apk);
  const manifest = buildManifest({
    apkName,
    sha256,
    size: statSync(apk).size,
    version: arg(argv, "--version"),
    versionCode: Number(arg(argv, "--version-code")),
    minSupportedVersionCode: Number(arg(argv, "--min-supported", "1")) || 1,
    notes: notesFile ? readFileSync(notesFile, "utf8") : "",
    publishedAt: new Date().toISOString(),
  });
  writeFileSync(path.join(out, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(path.join(out, "SHA256SUMS.txt"), checksumsText([{ name: apkName, sha256 }]));
  console.log(`${apkName} ${sha256} (${manifest.size} bytes)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

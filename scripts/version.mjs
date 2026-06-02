#!/usr/bin/env node
// Single source of truth for the BondCheck version (ADR 0006).
//
// The root package.json owns the version. This script copies it into every workspace
// package.json and into apps/mobile/app.json (`expo.version` and
// `expo.android.versionCode = major * 10000 + minor * 100 + patch`).
//
// Usage:
//   node scripts/version.mjs 1.2.3                 write 1.2.3 everywhere
//   node scripts/version.mjs --check               fail when any file disagrees
//   node scripts/version.mjs --check --tag v1.2.3  also fail when the tag differs (CI)
//   node scripts/version.mjs --json                print {"version","versionCode"}
//   --root <dir>                                   operate on another checkout (tests)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const WORKSPACE_DIRS = ["apps", "packages"];
const APP_JSON = "apps/mobile/app.json";

export function parseVersion(version) {
  const m = SEMVER.exec(version);
  if (!m) throw new Error(`"${version}" is not a plain x.y.z version`);
  return m.slice(1).map(Number);
}

/** Android versionCode: major * 10000 + minor * 100 + patch (minor and patch stay below 100). */
export function versionCode(version) {
  const [major, minor, patch] = parseVersion(version);
  if (minor > 99 || patch > 99) throw new Error(`minor and patch must be below 100 for versionCode (got ${version})`);
  const code = major * 10000 + minor * 100 + patch;
  if (code < 1) throw new Error("versionCode must be at least 1");
  return code;
}

function readJson(root, rel) {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

function writeJson(root, rel, data) {
  writeFileSync(path.join(root, rel), `${JSON.stringify(data, null, 2)}\n`);
}

/** Every package.json the version lives in, relative to the root (root first). */
export function packageFiles(root) {
  const files = ["package.json"];
  for (const dir of WORKSPACE_DIRS) {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs).sort()) {
      const rel = `${dir}/${name}/package.json`;
      if (existsSync(path.join(root, rel))) files.push(rel);
    }
  }
  return files;
}

/** Problems as human readable lines; empty when everything agrees. */
export function check(root, { tag } = {}) {
  const expected = readJson(root, "package.json").version;
  const problems = [];
  try {
    parseVersion(expected);
  } catch (e) {
    return [`package.json: ${e.message}`];
  }
  for (const rel of packageFiles(root).slice(1)) {
    const v = readJson(root, rel).version;
    if (v !== expected) problems.push(`${rel} has version ${v ?? "(missing)"}, expected ${expected}`);
  }
  if (existsSync(path.join(root, APP_JSON))) {
    const expo = readJson(root, APP_JSON).expo ?? {};
    if (expo.version !== expected) problems.push(`${APP_JSON} expo.version is ${expo.version ?? "(missing)"}, expected ${expected}`);
    const code = versionCode(expected);
    if (expo.android?.versionCode !== code) {
      problems.push(`${APP_JSON} expo.android.versionCode is ${expo.android?.versionCode ?? "(missing)"}, expected ${code}`);
    }
  }
  if (tag !== undefined && tag.replace(/^refs\/tags\//, "").replace(/^v/, "") !== expected) {
    problems.push(`tag ${tag} does not match version ${expected}`);
  }
  return problems;
}

export function setVersion(root, version) {
  const code = versionCode(version);
  const changed = [];
  for (const rel of packageFiles(root)) {
    const pkg = readJson(root, rel);
    if (pkg.version !== version) {
      pkg.version = version;
      writeJson(root, rel, pkg);
      changed.push(rel);
    }
  }
  if (existsSync(path.join(root, APP_JSON))) {
    const app = readJson(root, APP_JSON);
    app.expo ??= {};
    app.expo.android ??= {};
    if (app.expo.version !== version || app.expo.android.versionCode !== code) {
      app.expo.version = version;
      app.expo.android.versionCode = code;
      writeJson(root, APP_JSON, app);
      changed.push(APP_JSON);
    }
  }
  return changed;
}

function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const i = args.indexOf(flag);
    if (i === -1) return undefined;
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
    args.splice(i, 2);
    return value;
  };
  const root = path.resolve(take("--root") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const tag = take("--tag");

  if (args.includes("--json")) {
    const version = readJson(root, "package.json").version;
    console.log(JSON.stringify({ version, versionCode: versionCode(version) }));
    return 0;
  }
  if (args.includes("--check")) {
    const problems = check(root, { tag });
    if (problems.length) {
      for (const p of problems) console.error(`version mismatch: ${p}`);
      console.error("Fix with: node scripts/version.mjs <x.y.z>");
      return 1;
    }
    console.log(`versions agree: ${readJson(root, "package.json").version}${tag ? ` (tag ${tag})` : ""}`);
    return 0;
  }
  const version = args.find((a) => !a.startsWith("--"));
  if (!version) {
    console.error("usage: node scripts/version.mjs <x.y.z> | --check [--tag vX.Y.Z] | --json");
    return 2;
  }
  const changed = setVersion(root, version.replace(/^v/, ""));
  console.log(changed.length ? `set ${version} in ${changed.join(", ")}` : `already at ${version}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}

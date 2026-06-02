import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Exercises the repository's scripts/version.mjs against a throwaway workspace. */
const SCRIPT = path.resolve(__dirname, "../../../../scripts/version.mjs");

function workspace(version = "1.4.2", appVersion = version, versionCode = 10402) {
  const root = mkdtempSync(path.join(tmpdir(), "bc-version-"));
  const write = (rel: string, data: unknown) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), `${JSON.stringify(data, null, 2)}\n`);
  };
  write("package.json", { name: "bondcheck", version });
  write("apps/web/package.json", { name: "web", version });
  write("apps/mobile/package.json", { name: "mobile", version });
  write("packages/shared/package.json", { name: "@bondcheck/shared", version });
  write("apps/mobile/app.json", { expo: { name: "BondCheck", version: appVersion, android: { package: "pk.bondcheck.app", versionCode } } });
  return root;
}

const run = (root: string, ...args: string[]) =>
  spawnSync(process.execPath, [SCRIPT, "--root", root, ...args], { encoding: "utf8" });
const json = (root: string, rel: string) => JSON.parse(readFileSync(path.join(root, rel), "utf8"));

describe("scripts/version.mjs", () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
  const make = (...a: Parameters<typeof workspace>) => {
    const r = workspace(...a);
    roots.push(r);
    return r;
  };

  it("passes --check when every file agrees and the tag matches", () => {
    const res = run(make(), "--check", "--tag", "v1.4.2");
    expect(res.status).toBe(0);
  });

  it("fails --check when the tag does not equal the version", () => {
    const res = run(make(), "--check", "--tag", "v1.4.3");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("tag v1.4.3 does not match version 1.4.2");
  });

  it("fails --check when app.json or a package drifts", () => {
    const root = make("1.4.2", "1.4.1", 10401);
    const res = run(root, "--check");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("expo.version is 1.4.1, expected 1.4.2");
    expect(res.stderr).toContain("versionCode is 10401, expected 10402");
  });

  it("writes the version and the Android versionCode everywhere", () => {
    const root = make();
    expect(run(root, "2.10.7").status).toBe(0);
    expect(json(root, "package.json").version).toBe("2.10.7");
    expect(json(root, "packages/shared/package.json").version).toBe("2.10.7");
    expect(json(root, "apps/mobile/app.json").expo.version).toBe("2.10.7");
    expect(json(root, "apps/mobile/app.json").expo.android.versionCode).toBe(21007);
    expect(run(root, "--check", "--tag", "v2.10.7").status).toBe(0);
  });

  it("rejects versions that cannot map to a versionCode", () => {
    const root = make();
    expect(run(root, "1.100.0").status).toBe(2);
    expect(run(root, "1.2").status).toBe(2);
    expect(json(root, "package.json").version).toBe("1.4.2");
  });

  it("prints the version and versionCode for CI", () => {
    const res = run(make(), "--json");
    expect(JSON.parse(res.stdout)).toEqual({ version: "1.4.2", versionCode: 10402 });
  });
});

import { appManifestSchema } from "@bondcheck/shared";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.resolve(__dirname, "../release-manifest.mjs");
const CONTENT = "fixture apk bytes";

describe("scripts/release-manifest.mjs", () => {
  let dir: string;
  const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  const manifest = () => appManifestSchema.parse(JSON.parse(readFileSync(path.join(dir, "latest.json"), "utf8")));

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "bc-manifest-"));
    writeFileSync(path.join(dir, "bondcheck-1.2.0.apk"), CONTENT);
    writeFileSync(path.join(dir, "notes.md"), "Faster checks.\n");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("writes a latest.json that satisfies the shared contract, plus SHA256SUMS.txt", () => {
    const res = run("--apk", path.join(dir, "bondcheck-1.2.0.apk"), "--out", dir, "--version", "1.2.0", "--version-code", "10200", "--min-supported", "10000", "--notes-file", path.join(dir, "notes.md"));
    expect(res.status).toBe(0);
    const sha = createHash("sha256").update(CONTENT).digest("hex");
    expect(manifest()).toMatchObject({
      version: "1.2.0",
      versionCode: 10200,
      url: "/api/v1/releases/download/bondcheck-1.2.0.apk",
      sha256: sha,
      size: CONTENT.length,
      minSupportedVersionCode: 10000,
      notes: "Faster checks.",
    });
    expect(readFileSync(path.join(dir, "SHA256SUMS.txt"), "utf8")).toBe(`${sha}  bondcheck-1.2.0.apk\n`);
  });

  it("never lets minSupportedVersionCode exceed the release itself", () => {
    const res = run("--apk", path.join(dir, "bondcheck-1.2.0.apk"), "--out", dir, "--version", "1.2.0", "--version-code", "10200", "--min-supported", "99999");
    expect(res.status).toBe(0);
    expect(manifest().minSupportedVersionCode).toBe(10200);
  });

  it("refuses asset names that are not plain file names", () => {
    copyFileSync(path.join(dir, "bondcheck-1.2.0.apk"), path.join(dir, ".hidden.apk"));
    const res = run("--apk", path.join(dir, ".hidden.apk"), "--out", dir, "--version", "1.2.0", "--version-code", "10200");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("unsafe asset name");
  });
});

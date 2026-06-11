import { appManifestSchema } from "@bondcheck/shared";
import { describe, expect, it } from "vitest";
import { buildManifest, classifyAsset, parseChecksums, publicDownloads, SAFE_ASSET_NAME, versionCodeFor } from "./release-assets";

const sha = "a".repeat(64);
const assets = [
  { id: 1, name: "bondcheck-1.2.0.apk", size: 100 },
  { id: 2, name: "SHA256SUMS.txt", size: 10 },
  { id: 3, name: "latest.json", size: 10 },
  { id: 4, name: "BondCheck_1.2.0_x64-setup.exe", size: 200 },
];

describe("release assets", () => {
  it("classifies installable files and ignores metadata", () => {
    expect(classifyAsset("bondcheck-1.2.0.apk")).toBe("android");
    expect(classifyAsset("BondCheck_1.2.0_x64-setup.exe")).toBe("windows");
    expect(classifyAsset("BondCheck_1.2.0_aarch64.dmg")).toBe("macos");
    expect(classifyAsset("BondCheck.AppImage")).toBe("linux");
    expect(classifyAsset("latest.json")).toBeNull();
    expect(classifyAsset("SHA256SUMS.txt")).toBeNull();
    expect(classifyAsset("BondCheck.AppImage.sig")).toBeNull();
  });

  it("accepts only plain file names", () => {
    expect(SAFE_ASSET_NAME.test("bondcheck-1.2.0.apk")).toBe(true);
    for (const bad of ["../secret", "a/b.apk", ".env", "", "x".repeat(201), "a b.apk", "%2e%2e"]) {
      expect(SAFE_ASSET_NAME.test(bad), bad).toBe(false);
    }
  });

  it("parses sha256sum output", () => {
    expect(parseChecksums(`${sha}  bondcheck-1.2.0.apk\n${"B".repeat(64)} *other.exe\njunk\n`)).toEqual({
      "bondcheck-1.2.0.apk": sha,
      "other.exe": "b".repeat(64),
    });
  });

  it("lists downloads with relative proxy URLs, Android first", () => {
    const list = publicDownloads(assets, { "bondcheck-1.2.0.apk": sha });
    expect(list.map((d) => [d.name, d.platform, d.url, d.sha256])).toEqual([
      ["bondcheck-1.2.0.apk", "android", "/api/v1/releases/download/bondcheck-1.2.0.apk", sha],
      ["BondCheck_1.2.0_x64-setup.exe", "windows", "/api/v1/releases/download/BondCheck_1.2.0_x64-setup.exe", null],
    ]);
    expect(JSON.stringify(list)).not.toContain("github");
  });

  it("matches the versionCode formula of scripts/version.mjs", () => {
    expect(versionCodeFor("1.2.3")).toBe(10203);
    expect(versionCodeFor("v10.0.99")).toBe(100099);
    expect(versionCodeFor("1.100.0")).toBeNull();
    expect(versionCodeFor("1.2")).toBeNull();
  });
});

describe("buildManifest", () => {
  const base = { version: "1.2.0", publishedAt: "2026-06-10T09:00:00Z", notes: "Notes", assets, sums: { "bondcheck-1.2.0.apk": sha } };

  it("uses latest.json, normalising the URL and trusting SHA256SUMS.txt", () => {
    const manifestText = JSON.stringify({
      version: "1.2.0",
      versionCode: 10200,
      url: "https://somewhere.example/files/bondcheck-1.2.0.apk",
      sha256: "c".repeat(64),
      size: null,
      minSupportedVersionCode: 10000,
      notes: "From the manifest",
      publishedAt: null,
    });
    const m = buildManifest({ ...base, manifestText });
    expect(appManifestSchema.parse(m)).toEqual({
      version: "1.2.0",
      versionCode: 10200,
      url: "/api/v1/releases/download/bondcheck-1.2.0.apk",
      sha256: sha,
      size: 100,
      minSupportedVersionCode: 10000,
      notes: "From the manifest",
      publishedAt: "2026-06-10T09:00:00Z",
    });
  });

  it("ignores a manifest that points at a file outside the release and derives one instead", () => {
    const manifestText = JSON.stringify({ version: "9.9.9", versionCode: 90909, url: "/x/evil.apk", sha256: sha, size: 1, minSupportedVersionCode: 1, notes: "", publishedAt: null });
    const m = buildManifest({ ...base, manifestText });
    expect(m).toMatchObject({ version: "1.2.0", versionCode: 10200, url: "/api/v1/releases/download/bondcheck-1.2.0.apk", minSupportedVersionCode: 1 });
  });

  it("returns null without an APK or without a checksum to vouch for it", () => {
    expect(buildManifest({ ...base, assets: assets.filter((a) => !a.name.endsWith(".apk")), manifestText: null })).toBeNull();
    expect(buildManifest({ ...base, sums: {}, manifestText: "not json" })).toBeNull();
  });
});

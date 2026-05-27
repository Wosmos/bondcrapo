import type { AppManifest } from "@bondcheck/shared";
import { evaluateUpdate, isTrustedDownloadUrl, resolveDownloadUrl } from "../update";

const manifest = (over: Partial<AppManifest> = {}): AppManifest => ({
  version: "1.3.0",
  versionCode: 10300,
  url: "/api/v1/releases/download/bondcheck-1.3.0.apk",
  sha256: "c".repeat(64),
  size: 31_000_000,
  minSupportedVersionCode: 10000,
  notes: "Faster results",
  publishedAt: "2026-06-01T10:00:00Z",
  ...over,
});

describe("evaluateUpdate", () => {
  it("is current when the installed build is the same or newer", () => {
    expect(evaluateUpdate(10300, manifest()).kind).toBe("current");
    expect(evaluateUpdate(10400, manifest()).kind).toBe("current");
  });

  it("offers an optional update for older supported builds", () => {
    expect(evaluateUpdate(10200, manifest()).kind).toBe("optional");
  });

  it("requires an update below minSupportedVersionCode", () => {
    expect(evaluateUpdate(10200, manifest({ minSupportedVersionCode: 10300 })).kind).toBe("required");
  });

  it("never prompts when the installed version is unknown (Expo Go, tests)", () => {
    expect(evaluateUpdate(null, manifest()).kind).toBe("current");
  });
});

describe("download URL checks", () => {
  const site = "https://bondcheck.test";

  it("accepts relative and same-host https URLs", () => {
    expect(isTrustedDownloadUrl("/api/v1/releases/download/a.apk", site)).toBe(true);
    expect(isTrustedDownloadUrl("https://bondcheck.test/api/v1/releases/download/a.apk", site)).toBe(true);
    expect(resolveDownloadUrl("/api/v1/releases/download/a.apk", site)).toBe(
      "https://bondcheck.test/api/v1/releases/download/a.apk",
    );
  });

  it("rejects other hosts, other schemes and a missing site", () => {
    expect(isTrustedDownloadUrl("https://evil.example/a.apk", site)).toBe(false);
    expect(isTrustedDownloadUrl("intent://a.apk", site)).toBe(false);
    expect(isTrustedDownloadUrl("/a.apk", null)).toBe(false);
  });
});

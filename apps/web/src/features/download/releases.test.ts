import { afterEach, describe, expect, it } from "vitest";
import { cachedAssetUrl, clearSignedUrlCache, createReleaseSource } from "./releases";
import { fakeGitHub, RELEASE_JSON, SIGNED_URL } from "./__fixtures__/github";

afterEach(() => clearSignedUrlCache());

describe("GitHub release source", () => {
  it("is unavailable (unconfigured) without a token and makes no request", async () => {
    let called = false;
    const source = createReleaseSource({ repo: "Wosmos/bondcrapo", fetch: (async () => ((called = true), new Response())) as unknown as typeof fetch });
    expect(await source.latest()).toEqual({ status: "unavailable", reason: "unconfigured" });
    expect(called).toBe(false);
  });

  it("reads the latest release, its checksums and its manifest with the token", async () => {
    const { source, calls } = fakeGitHub();
    const lookup = await source.latest();
    expect(lookup.status).toBe("ok");
    if (lookup.status !== "ok") return;
    expect(lookup.release.version).toBe("1.2.0");
    expect(lookup.release.downloads).toHaveLength(1);
    expect(lookup.release.downloads[0]!.sha256).toBe("3f1a8c2e9b7d4f6a0c5e1b9d8a7f6e5d4c3b2a1908f7e6d5c4b3a2918f7e6d5c");
    expect(lookup.release.manifest).toMatchObject({ versionCode: 10200, minSupportedVersionCode: 10000 });
    expect(calls[0]!.url).toBe("https://api.github.com/repos/Wosmos/bondcrapo/releases/latest");
    for (const c of calls) {
      expect((c.init.headers as Record<string, string>).Authorization).toBe("Bearer github_pat_test_fixture_not_real");
      expect(c.init.next).toEqual({ revalidate: 300, tags: ["releases"] });
    }
  });

  it("maps 404 to none and other failures to unavailable", async () => {
    expect(await fakeGitHub({ latestStatus: 404 }).source.latest()).toEqual({ status: "none" });
    expect(await fakeGitHub({ latestStatus: 401 }).source.latest()).toEqual({ status: "unavailable", reason: "error" });
    expect(await fakeGitHub({ throws: true }).source.latest()).toEqual({ status: "unavailable", reason: "error" });
  });

  it("treats a draft or prerelease (unsigned builds) as no release", async () => {
    expect(await fakeGitHub({ release: { ...RELEASE_JSON, prerelease: true } }).source.latest()).toEqual({ status: "none" });
  });

  it("still serves the APK when latest.json is missing, deriving the manifest", async () => {
    const lookup = await fakeGitHub({ manifest: null }).source.latest();
    expect(lookup.status === "ok" && lookup.release.manifest).toMatchObject({ version: "1.2.0", versionCode: 10200, minSupportedVersionCode: 1 });
  });

  it("resolves the signed asset URL without following the redirect, and caches it briefly", async () => {
    const { source, calls } = fakeGitHub();
    expect(await cachedAssetUrl(source, 260000001, 1_000)).toBe(SIGNED_URL);
    expect(await cachedAssetUrl(source, 260000001, 30_000)).toBe(SIGNED_URL);
    expect(calls.filter((c) => c.init.redirect === "manual")).toHaveLength(1);
    expect(await cachedAssetUrl(source, 260000001, 90_000)).toBe(SIGNED_URL);
    expect(calls.filter((c) => c.init.redirect === "manual")).toHaveLength(2);
  });

  it("returns null when GitHub does not redirect", async () => {
    expect(await fakeGitHub({ redirectStatus: 404 }).source.assetUrl(260000001)).toBeNull();
  });
});

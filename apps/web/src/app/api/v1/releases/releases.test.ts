import { appManifestSchema, apiErrorSchema, releaseSchema } from "@bondcheck/shared";
import { afterEach, describe, expect, it } from "vitest";
import { GET as latest } from "./latest/route";
import { GET as download } from "./download/[asset]/route";
import { GET as updater } from "./updater/route";
import { clearSignedUrlCache, createReleaseSource, setReleaseSource } from "@/features/download/releases";
import { fakeGitHub, SIGNED_URL } from "@/features/download/__fixtures__/github";

const asset = (name: string) => ({ params: Promise.resolve({ asset: name }) });
const req = (path: string) => new Request(`http://localhost${path}`);

afterEach(() => {
  setReleaseSource(null);
  clearSignedUrlCache();
});

describe("GET /api/v1/releases/latest", () => {
  it("returns the public view: relative download URLs, no token, no GitHub URLs", async () => {
    setReleaseSource(fakeGitHub().source);
    const res = await latest();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=300, stale-while-revalidate=3600");
    const text = await res.text();
    expect(text).not.toMatch(/github|api\.github|github_pat/i);
    const body = releaseSchema.parse(JSON.parse(text));
    expect(body.status === "ok" && body.downloads[0]).toMatchObject({
      name: "bondcheck-1.2.0.apk",
      platform: "android",
      url: "/api/v1/releases/download/bondcheck-1.2.0.apk",
      size: 31457280,
    });
  });

  it("answers 503 unconfigured when the token is missing", async () => {
    setReleaseSource(createReleaseSource({ repo: "Wosmos/bondcrapo" }));
    const res = await latest();
    expect(res.status).toBe(503);
    expect(releaseSchema.parse(await res.json())).toEqual({ status: "unavailable", reason: "unconfigured" });
  });

  it("answers 404 none before the first release", async () => {
    setReleaseSource(fakeGitHub({ latestStatus: 404 }).source);
    const res = await latest();
    expect(res.status).toBe(404);
    expect(releaseSchema.parse(await res.json())).toEqual({ status: "none" });
  });
});

describe("GET /api/v1/releases/download/{asset}", () => {
  it("redirects (302, no-store) to the signed URL for an asset of the latest release", async () => {
    setReleaseSource(fakeGitHub().source);
    const res = await download(req("/api/v1/releases/download/bondcheck-1.2.0.apk"), asset("bondcheck-1.2.0.apk"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(SIGNED_URL);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses names that are not in the latest release or are not plain file names", async () => {
    const { source, calls } = fakeGitHub();
    setReleaseSource(source);
    for (const name of ["bondcheck-0.9.0.apk", "../../etc/passwd", ".env", "a/b"]) {
      const res = await download(req("/x"), asset(name));
      expect(res.status, name).toBe(404);
      expect(apiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    }
    expect(calls.some((c) => c.init.redirect === "manual")).toBe(false);
  });

  it("answers 503 with a friendly message when GitHub is unreachable", async () => {
    setReleaseSource(fakeGitHub({ throws: true }).source);
    const res = await download(req("/x"), asset("bondcheck-1.2.0.apk"));
    expect(res.status).toBe(503);
    const body = apiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("unavailable");
    expect(body.error.message).not.toMatch(/fetch|github|token/i);
  });

  it("answers 503 when the signed URL cannot be obtained", async () => {
    setReleaseSource(fakeGitHub({ redirectStatus: 403 }).source);
    const res = await download(req("/x"), asset("bondcheck-1.2.0.apk"));
    expect(res.status).toBe(503);
  });
});

describe("GET /api/v1/releases/updater", () => {
  it("serves latest.json as the shared manifest", async () => {
    setReleaseSource(fakeGitHub().source);
    const res = await updater();
    expect(res.status).toBe(200);
    expect(appManifestSchema.parse(await res.json())).toMatchObject({ version: "1.2.0", versionCode: 10200 });
  });

  it("answers 204 when there is nothing to update to", async () => {
    setReleaseSource(fakeGitHub({ latestStatus: 404 }).source);
    expect((await updater()).status).toBe(204);
  });
});

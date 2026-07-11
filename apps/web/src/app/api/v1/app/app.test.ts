import { apiErrorSchema, envelope, getAppLatest } from "@bondcheck/shared";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./latest/route";
import { createReleaseSource, setReleaseSource } from "@/features/download/releases";
import { fakeGitHub } from "@/features/download/__fixtures__/github";

afterEach(() => setReleaseSource(null));

describe("GET /api/v1/app/latest", () => {
  it("returns the update manifest in the { data } envelope", async () => {
    setReleaseSource(fakeGitHub().source);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
    const body = envelope(getAppLatest.response).parse(await res.json());
    expect(body.data).toMatchObject({
      version: "1.2.0",
      versionCode: 10200,
      url: "/api/v1/releases/download/bondcheck-1.2.0.apk",
      minSupportedVersionCode: 10000,
    });
  });

  it("answers unavailable when GitHub cannot be reached and not_found before the first release", async () => {
    setReleaseSource(createReleaseSource({ repo: "Wosmos/bondcrapo", fetch: (async () => { throw new Error("offline"); }) as unknown as typeof fetch }));
    let res = await GET();
    expect(res.status).toBe(503);
    expect(apiErrorSchema.parse(await res.json()).error.code).toBe("unavailable");

    setReleaseSource(fakeGitHub({ latestStatus: 404 }).source);
    res = await GET();
    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
  });
});

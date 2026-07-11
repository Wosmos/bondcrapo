import { afterEach, describe, expect, it } from "vitest";
import { createReleaseSource, setReleaseSource } from "@/features/download/releases";
import { fakeGitHub, SIGNED_URL } from "@/features/download/__fixtures__/github";
import { GET } from "./route";

describe("GET /api/v1/releases/apk", () => {
  afterEach(() => setReleaseSource(null));

  it("redirects straight to the signed APK download", async () => {
    setReleaseSource(fakeGitHub().source);
    const res = await GET(new Request("https://bondcheck.test/api/v1/releases/apk"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(SIGNED_URL);
  });

  it("sends the visitor to the download page when GitHub cannot be reached", async () => {
    setReleaseSource(createReleaseSource({ repo: "Wosmos/bondcrapo", fetch: (async () => { throw new Error("offline"); }) as unknown as typeof fetch }));
    const res = await GET(new Request("https://bondcheck.test/api/v1/releases/apk"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://bondcheck.test/en/download");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

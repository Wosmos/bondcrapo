import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/v1/releases/apk", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sends the visitor to the download page when releases are not configured", async () => {
    vi.stubEnv("GITHUB_RELEASES_TOKEN", "");
    const res = await GET(new Request("https://bondcheck.test/api/v1/releases/apk"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://bondcheck.test/en/download");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

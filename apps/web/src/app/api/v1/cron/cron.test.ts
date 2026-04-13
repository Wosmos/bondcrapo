import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./[job]/route";
import { isCronAuthorized } from "@/server/cron-auth";

const ctx = (job: string) => ({ params: Promise.resolve({ job }) });
const req = (method: string, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/v1/cron/bonds-sync", { method, headers });

afterEach(() => vi.unstubAllEnvs());

describe("cron dispatcher auth", () => {
  it("returns 401 without a secret even when CRON_SECRET is unset (fails closed)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(req("GET"), ctx("bonds-sync"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("still returns 401 when CRON_SECRET is unset and a bearer token is sent", async () => {
    vi.stubEnv("CRON_SECRET", "");
    for (const guess of ["", "undefined", "Bearer", "Bearer "]) {
      const res = await POST(req("POST", { authorization: `Bearer ${guess}` }), ctx("bonds-sync"));
      expect(res.status).toBe(401);
    }
  });

  it("returns 401 for a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "x".repeat(32));
    const res = await GET(req("GET", { authorization: `Bearer ${"y".repeat(32)}` }), ctx("bonds-sync"));
    expect(res.status).toBe(401);
  });

  it("authenticates before looking at the job name", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(req("GET"), ctx("does-not-exist"));
    expect(res.status).toBe(401);
  });

  it("with the right secret an unbuilt job answers 501 and an unknown job 404", async () => {
    const secret = "s".repeat(40);
    vi.stubEnv("CRON_SECRET", secret);
    const auth = { authorization: `Bearer ${secret}` };
    const notBuilt = await POST(req("POST", auth), ctx("bonds-sync"));
    expect(notBuilt.status).toBe(501);
    const unknown = await POST(req("POST", auth), ctx("nope"));
    expect(unknown.status).toBe(404);
  });

  it("rejects short secrets outright", async () => {
    expect(await isCronAuthorized("Bearer short", "short")).toBe(false);
    expect(await isCronAuthorized(null, "z".repeat(32))).toBe(false);
    expect(await isCronAuthorized(`Bearer ${"z".repeat(32)}`, "z".repeat(32))).toBe(true);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ingestionIssues, ingestionRuns } from "@bondcheck/db";
import { createTestDb, type TestDb } from "@bondcheck/db/testing";
import { Fetcher, runJob, runJobToCompletion, sha256Hex, type Job } from "./index";

function fakeFetch(responses: Array<Response | Error>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string> });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("Fetcher", () => {
  it("identifies itself, hashes the body and reports conditional responses", async () => {
    const { fn, calls } = fakeFetch([
      new Response("hello", { status: 200, headers: { etag: '"abc"', "content-type": "text/plain" } }),
      new Response(null, { status: 304 }),
    ]);
    const f = new Fetcher({ userAgent: "TestBot/1.0", fetch: fn, sleep: async () => undefined });
    const r = await f.get("https://example.test/a.txt");
    expect(r.body).toBe("hello");
    expect(r.sha256).toBe(await sha256Hex("hello"));
    expect(r.etag).toBe('"abc"');
    expect(calls[0]?.headers["User-Agent"]).toBe("TestBot/1.0");
    const again = await f.get("https://example.test/a.txt", { etag: r.etag ?? undefined });
    expect(again.notModified).toBe(true);
    expect(calls[1]?.headers["If-None-Match"]).toBe('"abc"');
  });

  it("spaces requests to one host and retries 503 with backoff", async () => {
    const sleeps: number[] = [];
    let clock = 1_000_000;
    const { fn } = fakeFetch([
      new Response("busy", { status: 503 }),
      new Response("ok", { status: 200 }),
      new Response("ok2", { status: 200 }),
    ]);
    const f = new Fetcher({
      userAgent: "TestBot/1.0",
      fetch: fn,
      minIntervalMs: 2000,
      baseBackoffMs: 100,
      random: () => 0,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });
    const r = await f.get("https://example.test/x");
    expect(r.body).toBe("ok");
    // one backoff of 100 ms, then a 2000 ms spacing wait before the retried request
    expect(sleeps[0]).toBe(100);
    await f.get("https://example.test/y");
    expect(sleeps.some((ms) => ms > 0 && ms <= 2000)).toBe(true);
  });

  it("gives up after maxRetries", async () => {
    const { fn } = fakeFetch([
      new Response("", { status: 500 }),
      new Response("", { status: 500 }),
      new Response("", { status: 500 }),
    ]);
    const f = new Fetcher({ userAgent: "T", fetch: fn, maxRetries: 2, sleep: async () => undefined });
    await expect(f.get("https://example.test/z")).rejects.toThrow(/500/);
  });
});

describe("runJob", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  });
  const fetcher = new Fetcher({ userAgent: "T", sleep: async () => undefined });

  it("records an ok run", async () => {
    const job: Job = { name: "bonds-sync", run: async () => ({ done: true, cursor: null, stats: { items: 3 } }) };
    const r = await runJob(job, { db: t.db, fetcher, trigger: "manual" });
    expect(r).toMatchObject({ status: "ok", done: true, stats: { items: 3 } });
    const [row] = await t.db.select().from(ingestionRuns).where(eq(ingestionRuns.id, r.runId));
    expect(row?.status).toBe("ok");
    expect(row?.finishedAt).not.toBeNull();
  });

  it("saves the cursor when chunked and resumes from it", async () => {
    const seen: unknown[] = [];
    const job: Job = {
      name: "fx-daily",
      run: async (_ctx, cursor) => {
        seen.push(cursor);
        const n = typeof cursor === "number" ? cursor : 0;
        return { done: n >= 2, cursor: n + 1, stats: { n } };
      },
    };
    const results = await runJobToCompletion(job, { db: t.db, fetcher, trigger: "cli" });
    expect(results.map((r) => r.done)).toEqual([false, false, true]);
    expect(seen).toEqual([null, 1, 2]);
    // a finished job starts from scratch next time
    await runJob(job, { db: t.db, fetcher, trigger: "cli" });
    expect(seen[3]).toBeNull();
  });

  it("marks failures and keeps the issue log", async () => {
    const job: Job = {
      name: "pk-market",
      run: async (ctx) => {
        await ctx.issue({ severity: "warn", entity: "rate", entityKey: "USD", message: "outside 5% band" });
        throw new Error("boom");
      },
    };
    const r = await runJob(job, { db: t.db, fetcher, trigger: "gha" });
    expect(r.status).toBe("failed");
    const issues = await t.db.select().from(ingestionIssues).where(eq(ingestionIssues.runId, r.runId));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("warn");
  });

  it("stops at the time budget", async () => {
    let clock = 0;
    const job: Job = {
      name: "housekeeping",
      run: async (ctx) => {
        clock += 50_000;
        return { done: !ctx.shouldStop(), cursor: "next", stats: {} };
      },
    };
    const r = await runJob(job, { db: t.db, fetcher, trigger: "vercel-cron", now: () => new Date(clock), budgetMs: 45_000 });
    expect(r.done).toBe(false);
    expect(r.status).toBe("partial");
  });
});

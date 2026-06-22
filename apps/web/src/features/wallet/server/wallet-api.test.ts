import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import {
  WALLET_COOKIE,
  envelope,
  formatWalletAuthHeader,
  walletsEndpoints,
  type AnyEndpoint,
} from "@bondcheck/shared";
import { getPushConfig } from "@bondcheck/shared/api/wallet-extra";
import { createTestDb, type TestDb } from "@bondcheck/db/testing";
import { drawPrizes, drawResults, draws, pushSubscriptions, rateLimits, walletBonds, walletMatches, wallets } from "@bondcheck/db";
import { createPgRateLimiter } from "@bondcheck/db/queries/wallet";
import { Fetcher, runJob } from "@bondcheck/ingest";
import { createWalletApi, WALLET_LIMITS, type WalletApi } from "./handlers";
import { createWalletNotifyJob, type PushMessage, type PushSubscriptionTarget } from "./notify";
import type { WalletDeps } from "./deps";

const PEPPER = "test-pepper-not-a-real-secret-0123456789";
const BASE = "http://localhost:3103";
let clock = new Date("2026-05-10T10:00:00Z");
let t: TestDb;
let api: WalletApi;

beforeAll(async () => {
  t = await createTestDb();
});

beforeEach(async () => {
  // Fresh tables per test without paying for a new PGlite boot.
  await t.client.exec(
    "delete from wallet_matches; delete from push_subscriptions; delete from wallet_bonds; delete from wallets; delete from draw_results; delete from draw_prizes; delete from draws; delete from rate_limits; delete from ingestion_issues; delete from ingestion_runs;",
  );
  clock = new Date("2026-05-10T10:00:00Z");
  const deps: WalletDeps = {
    db: t.db,
    pepper: PEPPER,
    limiter: createPgRateLimiter(t.db, () => clock),
    now: () => clock,
    vapid: null,
  };
  api = createWalletApi(() => deps, () => "BPublicKeyForTestsOnly");
});

interface CallOptions {
  body?: unknown;
  auth?: string;
  cookie?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  ip?: string;
}

async function call(handler: keyof WalletApi, method: string, path: string, o: CallOptions = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": o.ip ?? "198.51.100.10", ...o.headers };
  if (o.body !== undefined) headers["content-type"] = "application/json";
  if (o.auth) headers.authorization = o.auth;
  if (o.cookie) headers.cookie = `${WALLET_COOKIE}=${o.cookie}`;
  const req = new NextRequest(`${BASE}/api/v1${path}`, {
    method,
    headers,
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const res = await api[handler](req, { params: Promise.resolve(o.params ?? {}) });
  const json = await res.json();
  return { res, json };
}

/** Every success body must parse with the shared contract, as the mobile client will parse it. */
function expectContract(endpoint: AnyEndpoint, json: unknown) {
  const parsed = envelope(endpoint.response).safeParse(json);
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
}

async function createWallet() {
  const { res, json } = await call("create", "POST", "/wallets", { body: { locale: "en", timezone: "Asia/Karachi" } });
  expect(res.status).toBe(201);
  expectContract(walletsEndpoints.createWallet, json);
  const { walletId, token, syncCode } = json.data as { walletId: string; token: string; syncCode: string };
  return { walletId, token, syncCode, auth: formatWalletAuthHeader({ walletId, token }), res };
}

async function publishDraw(denom: string, date: string, results: [number, number][]) {
  const [d] = await t.db
    .insert(draws)
    .values({ denominationCode: denom, drawDate: date, status: "published", completeness: "full", publishedAt: clock, updatedAt: clock })
    .returning({ id: draws.id });
  await t.db.insert(drawResults).values(results.map(([bondNumber, tier]) => ({ drawId: d!.id, bondNumber, tier })));
  await t.db.insert(drawPrizes).values([
    { drawId: d!.id, tier: 1, amountPkr: 1_500_000, winnersCount: 1 },
    { drawId: d!.id, tier: 2, amountPkr: 500_000, winnersCount: 3 },
    { drawId: d!.id, tier: 3, amountPkr: 9_300, winnersCount: 1_696 },
  ]);
  return d!.id;
}

describe("wallet API (route handlers on PGlite)", () => {
  it("create, add 3 bonds, a new draw matches one, wallet-notify records one match and sends one push", async () => {
    const w = await createWallet();
    expect(w.syncCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    const cookie = w.res.headers.get("set-cookie")!;
    expect(cookie).toContain(`${WALLET_COOKIE}=${w.walletId}.${w.token}`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");

    // Only hashes are stored.
    const [row] = await t.db.select().from(wallets).where(eq(wallets.id, w.walletId));
    expect(row!.tokenHash).not.toContain(w.token);
    expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.syncCodeHash).toMatch(/^[0-9a-f]{64}$/);

    const put = await call("putBonds", "PUT", "/wallets/me/bonds", {
      auth: w.auth,
      body: {
        bonds: [
          { denominationCode: "750", bondNumber: "123456", label: "Ammi" },
          { denominationCode: "750", bondNumber: "654321" },
          { denominationCode: "1500", bondNumber: "000777" },
        ],
      },
    });
    expect(put.res.status).toBe(200);
    expectContract(walletsEndpoints.putWalletBonds, put.json);
    expect(put.json.data).toEqual({ added: 3, newMatches: 0 });

    const list = await call("listBonds", "GET", "/wallets/me/bonds", { auth: w.auth });
    expectContract(walletsEndpoints.listWalletBonds, list.json);
    expect(list.json.data.map((b: { bondNumber: string }) => b.bondNumber)).toEqual(["000777", "123456", "654321"]);

    clock = new Date("2026-05-15T12:00:00Z");
    await t.db.insert(pushSubscriptions).values({
      walletId: w.walletId,
      platform: "webpush",
      endpoint: "https://push.example/subscription/1",
      keys: { p256dh: "test-key", auth: "test-auth" },
    });
    await publishDraw("750", "2026-05-15", [
      [111111, 1],
      [654321, 3],
      // Same number, other denomination: must not match the 1500 bond.
      [777, 3],
    ]);

    const sent: { sub: PushSubscriptionTarget; message: PushMessage }[] = [];
    const job = createWalletNotifyJob({
      sendPush: async (sub, message) => {
        sent.push({ sub, message });
        return { ok: true, expired: false };
      },
    });
    const fetcher = new Fetcher({ userAgent: "test" });
    const first = await runJob(job, { db: t.db, fetcher, trigger: "manual", now: () => clock });
    expect(first.status).toBe("ok");
    expect(first.stats).toMatchObject({ newMatches: 1, pushed: 1, walletsNotified: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.message.body).toContain("654321");
    expect(sent[0]!.message.url).toBe("/en/my/wins");
    const matchRows = await t.db.select().from(walletMatches).where(eq(walletMatches.walletId, w.walletId));
    expect(matchRows).toHaveLength(1);
    expect(matchRows[0]).toMatchObject({ bondNumber: 654321, tier: 3, amountPkr: 9_300 });
    expect(matchRows[0]!.notifiedAt).not.toBeNull();

    // A second run (duplicate trigger) changes nothing and pushes nothing.
    const second = await runJob(job, { db: t.db, fetcher, trigger: "gha", now: () => clock });
    expect(second.stats).toMatchObject({ newMatches: 0, pushed: 0 });
    expect(sent).toHaveLength(1);

    const matches = await call("matches", "GET", "/wallets/me/matches", { auth: w.auth });
    expectContract(walletsEndpoints.listWalletMatches, matches.json);
    expect(matches.json.data[0]).toMatchObject({ bondNumber: "654321", tier: 3, amountPkr: 9300, seenAt: null });

    const me = await call("me", "GET", "/wallets/me", { cookie: `${w.walletId}.${w.token}` });
    expectContract(walletsEndpoints.getWallet, me.json);
    expect(me.json.data).toMatchObject({ bondCount: 3, matchCount: 1, hasUnseenMatches: true, locale: "en", timezone: "Asia/Karachi" });
    expect(me.res.headers.get("cache-control")).toContain("no-store");

    const seen = await call("matchesSeen", "POST", "/wallets/me/matches/seen", { auth: w.auth, body: {} });
    expectContract(walletsEndpoints.markMatchesSeen, seen.json);
    expect(seen.json.data).toEqual({ updated: 1 });

    const analytics = await call("analytics", "GET", "/wallets/me/analytics", { auth: w.auth });
    expectContract(walletsEndpoints.walletAnalytics, analytics.json);
    expect(analytics.json.data.totals).toEqual({ bonds: 3, faceValuePkr: 3000, winsCount: 1, winningsPkr: 9300 });
    expect(analytics.json.data.expectedValuePkrPerDraw).toBeGreaterThan(0);
  });

  it("all-time check on add finds past wins without pushing them", async () => {
    await publishDraw("200", "2019-03-15", [[100200, 2]]);
    const w = await createWallet();
    const imp = await call("importBonds", "POST", "/wallets/me/bonds/import", {
      auth: w.auth,
      body: {
        source: "csv",
        bonds: [
          { denominationCode: "200", bondNumber: "100200" },
          { denominationCode: "200", bondNumber: "100201" },
          { denominationCode: "200", bondNumber: "100201" },
        ],
      },
    });
    expectContract(walletsEndpoints.importWalletBonds, imp.json);
    expect(imp.json.data).toEqual({ added: 2, skipped: 1, newMatches: 1 });
    const job = createWalletNotifyJob({ sendPush: async () => ({ ok: true, expired: false }) });
    const r = await runJob(job, { db: t.db, fetcher: new Fetcher({ userAgent: "test" }), trigger: "manual", now: () => clock });
    expect(r.stats).toMatchObject({ pushed: 0, walletsNotified: 0 });

    const analytics = await call("analytics", "GET", "/wallets/me/analytics", { auth: w.auth });
    // 100201 is one digit away from the tier 2 winner 100200.
    expect(analytics.json.data.nearMisses).toEqual([
      expect.objectContaining({ bondNumber: "100201", winningNumber: "100200", tier: 2, reason: "one_digit_off" }),
    ]);

    const del = await call("deleteBond", "DELETE", "/wallets/me/bonds/200/100200", {
      auth: w.auth,
      params: { denomination: "200", number: "100200" },
    });
    expectContract(walletsEndpoints.deleteWalletBond, del.json);
    const again = await call("deleteBond", "DELETE", "/wallets/me/bonds/200/100200", {
      auth: w.auth,
      params: { denomination: "200", number: "100200" },
    });
    expect(again.res.status).toBe(404);
    const bad = await call("deleteBond", "DELETE", "/wallets/me/bonds/200/12", {
      auth: w.auth,
      params: { denomination: "200", number: "12" },
    });
    expect(bad.res.status).toBe(400);
  });

  it("restore with the sync code issues a new token, revokes the old one and rotates the code", async () => {
    const w = await createWallet();
    const restored = await call("restore", "POST", "/wallets/restore", {
      body: { syncCode: w.syncCode.toLowerCase() },
      ip: "203.0.113.5",
    });
    expect(restored.res.status).toBe(200);
    expectContract(walletsEndpoints.restoreWallet, restored.json);
    const fresh = restored.json.data as { walletId: string; token: string; syncCode: string };
    expect(fresh.walletId).toBe(w.walletId);
    expect(fresh.token).not.toBe(w.token);
    expect(fresh.syncCode).not.toBe(w.syncCode);
    expect(restored.res.headers.get("set-cookie")).toContain(`${w.walletId}.${fresh.token}`);

    const old = await call("me", "GET", "/wallets/me", { cookie: `${w.walletId}.${w.token}` });
    expect(old.res.status).toBe(401);
    expect(old.json.error.details).toEqual({ reason: "revoked" });
    // The stale cookie is cleared so the browser stops sending it.
    expect(old.res.headers.get("set-cookie")).toMatch(new RegExp(`${WALLET_COOKIE}=;`));

    const ok = await call("me", "GET", "/wallets/me", { auth: formatWalletAuthHeader(fresh) });
    expect(ok.res.status).toBe(200);

    const reused = await call("restore", "POST", "/wallets/restore", { body: { syncCode: w.syncCode }, ip: "203.0.113.5" });
    expect(reused.res.status).toBe(404);

    const rotated = await call("rotateSyncCode", "POST", "/wallets/me/sync-code", { auth: formatWalletAuthHeader(fresh) });
    expectContract(walletsEndpoints.rotateSyncCode, rotated.json);
    const stale = await call("restore", "POST", "/wallets/restore", { body: { syncCode: fresh.syncCode }, ip: "203.0.113.6" });
    expect(stale.res.status).toBe(404);
    const current = await call("restore", "POST", "/wallets/restore", {
      body: { syncCode: rotated.json.data.syncCode },
      ip: "203.0.113.6",
    });
    expect(current.res.status).toBe(200);

    const missing = await call("me", "GET", "/wallets/me");
    expect(missing.res.status).toBe(401);
    expect(missing.json.error.details).toEqual({ reason: "missing" });
  });

  it("enforces the restore rate limit per client address hash (5 per hour)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await call("restore", "POST", "/wallets/restore", { body: { syncCode: "0000-0000-0000" }, ip: "192.0.2.44" });
      statuses.push(r.res.status);
    }
    expect(statuses).toEqual([404, 404, 404, 404, 404, 429]);
    const limited = await call("restore", "POST", "/wallets/restore", { body: { syncCode: "0000-0000-0000" }, ip: "192.0.2.44" });
    expect(limited.res.headers.get("retry-after")).toBe("3600");
    expect(WALLET_LIMITS.restore.limit).toBe(5);
    // Another address is unaffected, and no raw address is stored.
    const other = await call("restore", "POST", "/wallets/restore", { body: { syncCode: "0000-0000-0000" }, ip: "192.0.2.45" });
    expect(other.res.status).toBe(404);
    const keys = (await t.db.select().from(rateLimits)).map((r) => r.key);
    expect(keys.join(" ")).not.toContain("192.0.2");
    // The window resets after an hour.
    clock = new Date("2026-05-10T11:00:01Z");
    const later = await call("restore", "POST", "/wallets/restore", { body: { syncCode: "0000-0000-0000" }, ip: "192.0.2.44" });
    expect(later.res.status).toBe(404);
  });

  it("DELETE /wallets/me removes every row that belongs to the wallet", async () => {
    const w = await createWallet();
    const keep = await createWallet();
    await publishDraw("750", "2025-01-15", [[123456, 3]]);
    for (const x of [w, keep]) {
      await call("putBonds", "PUT", "/wallets/me/bonds", {
        auth: x.auth,
        body: { bonds: [{ denominationCode: "750", bondNumber: "123456" }] },
      });
    }
    await call("pushSubscribe", "POST", "/wallets/me/push", {
      auth: w.auth,
      body: {
        platform: "webpush",
        endpoint: "https://push.example/subscription/2",
        keys: { p256dh: "B".padEnd(87, "x"), auth: "a".repeat(22) },
      },
    });
    const del = await call("remove", "DELETE", "/wallets/me", { cookie: `${w.walletId}.${w.token}` });
    expectContract(walletsEndpoints.deleteWallet, del.json);
    expect(del.res.headers.get("set-cookie")).toMatch(new RegExp(`${WALLET_COOKIE}=;`));
    for (const [table, col] of [
      [wallets, wallets.id],
      [walletBonds, walletBonds.walletId],
      [walletMatches, walletMatches.walletId],
      [pushSubscriptions, pushSubscriptions.walletId],
    ] as const) {
      expect(await t.db.select().from(table).where(eq(col, w.walletId))).toEqual([]);
    }
    expect(await t.db.select().from(walletBonds).where(eq(walletBonds.walletId, keep.walletId))).toHaveLength(1);
    const after = await call("me", "GET", "/wallets/me", { auth: w.auth });
    expect(after.res.status).toBe(401);
  });

  it("validates input and blocks cross-site writes", async () => {
    const w = await createWallet();
    const unknown = await call("putBonds", "PUT", "/wallets/me/bonds", {
      auth: w.auth,
      body: { bonds: [{ denominationCode: "999", bondNumber: "123456" }] },
    });
    expect(unknown.res.status).toBe(400);
    expect(unknown.json.error.details).toEqual({ denominations: ["999"] });

    const shortNumber = await call("putBonds", "PUT", "/wallets/me/bonds", {
      auth: w.auth,
      body: { bonds: [{ denominationCode: "750", bondNumber: "12345" }] },
    });
    expect(shortNumber.res.status).toBe(400);
    expect(JSON.stringify(shortNumber.json)).not.toContain("12345\"");

    const notJson = await api.putBonds(
      new NextRequest(`${BASE}/api/v1/wallets/me/bonds`, {
        method: "PUT",
        headers: { authorization: w.auth, "content-type": "text/plain" },
        body: "bonds=1",
      }),
      { params: Promise.resolve({}) },
    );
    expect(notJson.status).toBe(400);

    const crossSite = await call("putBonds", "PUT", "/wallets/me/bonds", {
      cookie: `${w.walletId}.${w.token}`,
      headers: { origin: "https://evil.example", host: "localhost:3103" },
      body: { bonds: [{ denominationCode: "750", bondNumber: "123456" }] },
    });
    expect(crossSite.res.status).toBe(403);
    const forgedRestore = await call("restore", "POST", "/wallets/restore", {
      headers: { "sec-fetch-site": "cross-site" },
      body: { syncCode: w.syncCode },
    });
    expect(forgedRestore.res.status).toBe(403);

    const badPush = await call("pushSubscribe", "POST", "/wallets/me/push", {
      auth: w.auth,
      body: { platform: "webpush", endpoint: "http://push.example/x", keys: { p256dh: "x", auth: "y" } },
    });
    expect(badPush.res.status).toBe(400);

    const wrongToken = await call("me", "GET", "/wallets/me", {
      auth: formatWalletAuthHeader({ walletId: w.walletId, token: "A".repeat(43) }),
    });
    expect(wrongToken.res.status).toBe(401);

    const cfg = await call("pushConfig", "GET", "/wallets/push-config");
    expectContract(getPushConfig, cfg.json);
    expect(cfg.json.data).toEqual({ vapidPublicKey: "BPublicKeyForTestsOnly" });
  });

  it("answers 503 with a clear message when wallets are not configured", async () => {
    const { WalletUnavailableError } = await import("./deps");
    const unconfigured = createWalletApi(() => {
      throw new WalletUnavailableError("wallets are not configured on this server");
    });
    const res = await unconfigured.create(new NextRequest(`${BASE}/api/v1/wallets`, { method: "POST" }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("unavailable");
    const cfg = await unconfigured.pushConfig(new NextRequest(`${BASE}/api/v1/wallets/push-config`), {
      params: Promise.resolve({}),
    });
    expect((await cfg.json()).data).toEqual({ vapidPublicKey: null });
  });
});

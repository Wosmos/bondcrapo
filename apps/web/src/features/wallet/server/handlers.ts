import "server-only";
import type { NextRequest } from "next/server";
import {
  LOCALES,
  createWallet,
  deleteWalletBond as deleteWalletBondEndpoint,
  formatBondNumber,
  importWalletBonds,
  markMatchesSeen,
  putWalletBonds,
  restoreWallet,
  subscribePush,
  unsubscribePush,
  uuidv7,
  type RateLimitRule,
} from "@bondcheck/shared";
import {
  formatSyncCode,
  generateSyncCode,
  generateWalletToken,
  hashClientAddress,
  hashSyncCode,
  hashWalletToken,
  timingSafeEqualHex,
} from "@bondcheck/shared/wallet/secrets";
import { expectedValuePerDraw, faceValueTotal, summarizeWins } from "@bondcheck/shared/wallet/analytics";
import { findNearMisses } from "@bondcheck/shared/wallet/near-miss";
import * as q from "@bondcheck/db/queries/wallet";
import { errorResponse } from "@/server/http";
import type { WalletDeps } from "./deps";
import { WalletUnavailableError } from "./deps";
import {
  HttpError,
  assertSameOrigin,
  clearWalletCookie,
  clientAddress,
  credentialsFrom,
  parseWith,
  privateJson,
  rateLimited,
  readBody,
  setWalletCookie,
} from "./http";

/** Rate limits (PLAN section 11). Restore is the strict one: 60 bit codes and 5 tries an hour. */
export const WALLET_LIMITS = {
  create: { name: "wallet-create", limit: 10, windowSeconds: 3600 },
  restore: { name: "wallet-restore", limit: 5, windowSeconds: 3600 },
  rotate: { name: "wallet-rotate", limit: 10, windowSeconds: 3600 },
  write: { name: "wallet-write", limit: 120, windowSeconds: 3600 },
  push: { name: "wallet-push", limit: 20, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

/** Upper bound on bonds per wallet: generous for families, small enough to keep checks instant. */
export const MAX_BONDS_PER_WALLET = 20_000;
const MAX_PUSH_SUBSCRIPTIONS = 10;
/** Only refresh `last_seen_at` once an hour, not on every request. */
const TOUCH_INTERVAL_MS = 3600 * 1000;

type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };
type Handler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

function todayInPakistan(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(now);
}

function validTimezone(tz: string | undefined): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export function createWalletApi(
  getDeps: () => WalletDeps,
  getVapidPublicKey: () => string | null = () => getDeps().vapid?.publicKey ?? null,
) {
  /** Wraps a handler with dependency loading, CSRF checks and safe error mapping. */
  const route =
    (fn: (req: NextRequest, deps: WalletDeps, ctx: RouteContext) => Promise<Response>): Handler =>
    async (req, ctx) => {
      try {
        assertSameOrigin(req);
        const deps = getDeps();
        return await fn(req, deps, ctx);
      } catch (error) {
        if (error instanceof HttpError) return error.response;
        if (error instanceof WalletUnavailableError) return errorResponse("unavailable", error.message);
        // Log the failure class only: never bond numbers, tokens or codes.
        console.error("[wallet] request failed:", error instanceof Error ? error.name : typeof error);
        return errorResponse("internal", "Something went wrong. Please try again.");
      }
    };

  async function limit(deps: WalletDeps, rule: RateLimitRule, subject: string): Promise<void> {
    const r = await deps.limiter.hit(rule, subject);
    if (!r.allowed) throw new HttpError(rateLimited(r.retryAfterSeconds));
  }

  async function addressSubject(deps: WalletDeps, req: NextRequest): Promise<string> {
    return (await hashClientAddress(deps.pepper, clientAddress(req))).slice(0, 32);
  }

  /** Resolves the calling wallet from `Authorization: Wallet <id>.<token>` or the `bc_wallet` cookie. */
  async function authenticate(req: NextRequest, deps: WalletDeps): Promise<string> {
    const { credentials, viaCookie } = credentialsFrom(req);
    const fail = (reason: "missing" | "revoked") => {
      const res = errorResponse(
        "unauthorized",
        reason === "missing" ? "No wallet on this device yet." : "This wallet is no longer open on this device.",
        { reason },
      );
      if (viaCookie) clearWalletCookie(res, req);
      return new HttpError(res);
    };
    if (!credentials) throw fail(viaCookie ? "revoked" : "missing");
    const row = await q.findWalletForAuth(deps.db, credentials.walletId);
    const hash = await hashWalletToken(deps.pepper, credentials.token);
    // Compare even when the row is missing so timing does not reveal which wallet ids exist.
    const ok = timingSafeEqualHex(hash, row?.tokenHash ?? "0".repeat(64));
    if (!row || !ok) throw fail("revoked");
    const now = deps.now();
    if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) await q.touchWallet(deps.db, row.id, now);
    return row.id;
  }

  async function issueCredentials(deps: WalletDeps) {
    const token = generateWalletToken();
    const syncCode = generateSyncCode();
    return {
      token,
      syncCode,
      tokenHash: await hashWalletToken(deps.pepper, token),
      syncCodeHash: await hashSyncCode(deps.pepper, syncCode),
    };
  }

  async function validateBonds(
    deps: WalletDeps,
    walletId: string,
    bonds: { denominationCode: string; bondNumber: string; label?: string }[],
  ) {
    const faceValues = await q.denominationFaceValues(deps.db);
    const unknown = [...new Set(bonds.map((b) => b.denominationCode))].filter((c) => !(c in faceValues));
    if (unknown.length) {
      throw new HttpError(errorResponse("bad_request", "unknown denomination", { denominations: unknown.slice(0, 10) }));
    }
    const existing = await q.countWalletBonds(deps.db, walletId);
    if (existing + bonds.length > MAX_BONDS_PER_WALLET) {
      throw new HttpError(
        errorResponse("conflict", `A wallet can hold up to ${MAX_BONDS_PER_WALLET} bonds.`, {
          limit: MAX_BONDS_PER_WALLET,
          current: existing,
        }),
      );
    }
    // Last write wins inside one request, so a repeated number with a new label is not an error.
    const unique = new Map<string, q.BondInput>();
    for (const b of bonds) {
      const label = b.label?.trim() || null;
      unique.set(`${b.denominationCode}:${b.bondNumber}`, {
        denominationCode: b.denominationCode,
        bondNumber: Number(b.bondNumber),
        label,
      });
    }
    return [...unique.values()];
  }

  return {
    /** POST /wallets */
    create: route(async (req, deps) => {
      await limit(deps, WALLET_LIMITS.create, await addressSubject(deps, req));
      const body = await readBody(req, createWallet.body!, { optional: true });
      const id = uuidv7(deps.now().getTime());
      const c = await issueCredentials(deps);
      await q.insertWallet(deps.db, {
        id,
        tokenHash: c.tokenHash,
        syncCodeHash: c.syncCodeHash,
        locale: body.locale && (LOCALES as readonly string[]).includes(body.locale) ? body.locale : null,
        timezone: validTimezone(body.timezone),
        now: deps.now(),
      });
      const res = privateJson({ walletId: id, token: c.token, syncCode: formatSyncCode(c.syncCode) }, 201);
      setWalletCookie(res, req, { walletId: id, token: c.token });
      return res;
    }),

    /** POST /wallets/restore: new token and new sync code; the old token stops working. */
    restore: route(async (req, deps) => {
      await limit(deps, WALLET_LIMITS.restore, await addressSubject(deps, req));
      const body = await readBody(req, restoreWallet.body!);
      const c = await issueCredentials(deps);
      const walletId = await q.restoreWalletBySyncCode(deps.db, {
        syncCodeHash: await hashSyncCode(deps.pepper, body.syncCode),
        newTokenHash: c.tokenHash,
        newSyncCodeHash: c.syncCodeHash,
        now: deps.now(),
      });
      if (!walletId) {
        return errorResponse("not_found", "No wallet matches this sync code. Check it and try again.");
      }
      const res = privateJson({ walletId, token: c.token, syncCode: formatSyncCode(c.syncCode) });
      setWalletCookie(res, req, { walletId, token: c.token });
      return res;
    }),

    /** POST /wallets/me/sync-code */
    rotateSyncCode: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      await limit(deps, WALLET_LIMITS.rotate, walletId);
      const code = generateSyncCode();
      await q.setSyncCodeHash(deps.db, walletId, await hashSyncCode(deps.pepper, code));
      return privateJson({ syncCode: formatSyncCode(code) });
    }),

    /** GET /wallets/me */
    me: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      const profile = await q.getWalletProfile(deps.db, walletId);
      if (!profile) throw new HttpError(errorResponse("unauthorized", "This wallet no longer exists.", { reason: "revoked" }));
      return privateJson(profile);
    }),

    /** DELETE /wallets/me: erases the wallet, its bonds, wins and push subscriptions. */
    remove: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      await q.deleteWalletById(deps.db, walletId);
      const res = privateJson({ ok: true as const });
      clearWalletCookie(res, req);
      return res;
    }),

    /** GET /wallets/me/bonds */
    listBonds: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      const rows = await q.listWalletBonds(deps.db, walletId);
      return privateJson(rows.map((r) => ({ ...r, bondNumber: formatBondNumber(r.bondNumber) })));
    }),

    /** PUT /wallets/me/bonds: add or relabel, then check every new bond against all draws. */
    putBonds: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      await limit(deps, WALLET_LIMITS.write, walletId);
      const body = await readBody(req, putWalletBonds.body!);
      const bonds = await validateBonds(deps, walletId, body.bonds);
      const { added, numbers } = await q.upsertWalletBonds(deps.db, walletId, bonds, {
        now: deps.now(),
        updateLabels: true,
      });
      const newMatches = await q.matchWalletBonds(deps.db, walletId, { now: deps.now(), bondNumbers: numbers });
      return privateJson({ added, newMatches });
    }),

    /** POST /wallets/me/bonds/import: like PUT, but existing bonds are left as they are. */
    importBonds: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      await limit(deps, WALLET_LIMITS.write, walletId);
      const body = await readBody(req, importWalletBonds.body!);
      const bonds = await validateBonds(deps, walletId, body.bonds);
      const { added, numbers } = await q.upsertWalletBonds(deps.db, walletId, bonds, {
        now: deps.now(),
        updateLabels: false,
      });
      const newMatches = await q.matchWalletBonds(deps.db, walletId, { now: deps.now(), bondNumbers: numbers });
      return privateJson({ added, skipped: body.bonds.length - added, newMatches });
    }),

    /** DELETE /wallets/me/bonds/{denomination}/{number} */
    deleteBond: route(async (req, deps, ctx) => {
      const walletId = await authenticate(req, deps);
      const params = parseWith(deleteWalletBondEndpoint.params!, await ctx.params);
      const removed = await q.deleteWalletBond(deps.db, walletId, params.denomination, Number(params.number));
      if (!removed) return errorResponse("not_found", "That bond is not in your wallet.");
      return privateJson({ ok: true as const });
    }),

    /** GET /wallets/me/matches */
    matches: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      const rows = await q.listWalletMatches(deps.db, walletId);
      return privateJson(rows.map((r) => ({ ...r, bondNumber: formatBondNumber(r.bondNumber) })));
    }),

    /** POST /wallets/me/matches/seen: all unseen, or the listed ones. */
    matchesSeen: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      const body = await readBody(req, markMatchesSeen.body!, { optional: true });
      const updated = await q.markWalletMatchesSeen(deps.db, walletId, {
        now: deps.now(),
        matches: body.matches?.map((m) => ({ drawId: m.drawId, bondNumber: Number(m.bondNumber) })),
      });
      return privateJson({ updated });
    }),

    /** GET /wallets/me/analytics */
    analytics: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      const [holdings, faceValues, matches, owned] = await Promise.all([
        q.walletHoldings(deps.db, walletId),
        q.denominationFaceValues(deps.db),
        q.listWalletMatches(deps.db, walletId),
        q.walletBondRefs(deps.db, walletId),
      ]);
      const codes = holdings.map((h) => h.denominationCode);
      const [winners, prizeTables, upcomingDraws] = await Promise.all([
        q.topWinningNumbers(deps.db, codes),
        q.latestPrizeTables(deps.db, codes),
        q.upcomingDrawsFor(deps.db, codes, todayInPakistan(deps.now())),
      ]);
      const wins = summarizeWins(matches);
      return privateJson({
        totals: {
          bonds: holdings.reduce((n, h) => n + h.count, 0),
          faceValuePkr: faceValueTotal(holdings, faceValues),
          winsCount: wins.winsCount,
          winningsPkr: wins.winningsPkr,
        },
        winsByYear: wins.byYear,
        winsByTier: wins.byTier,
        nearMisses: findNearMisses(owned, winners, { limit: 100 }),
        expectedValuePkrPerDraw: expectedValuePerDraw(holdings, prizeTables),
        upcomingDraws,
      });
    }),

    /** POST /wallets/me/push */
    pushSubscribe: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      await limit(deps, WALLET_LIMITS.push, walletId);
      const body = await readBody(req, subscribePush.body!);
      if (body.platform === "webpush") {
        let url: URL;
        try {
          url = new URL(body.endpoint);
        } catch {
          return errorResponse("bad_request", "push endpoint must be a URL");
        }
        const keys = body.keys ?? {};
        if (url.protocol !== "https:" || !/^[A-Za-z0-9_-]{80,100}$/.test(keys.p256dh ?? "") || !/^[A-Za-z0-9_-]{16,32}$/.test(keys.auth ?? "")) {
          return errorResponse("bad_request", "invalid web push subscription");
        }
      }
      if ((await q.countPushSubscriptions(deps.db, walletId)) >= MAX_PUSH_SUBSCRIPTIONS) {
        return errorResponse("conflict", "Too many devices have notifications on. Turn one off first.");
      }
      await q.upsertPushSubscription(deps.db, walletId, body, deps.now());
      return privateJson({ ok: true as const }, 201);
    }),

    /** DELETE /wallets/me/push */
    pushUnsubscribe: route(async (req, deps) => {
      const walletId = await authenticate(req, deps);
      const body = await readBody(req, unsubscribePush.body!);
      await q.deletePushSubscription(deps.db, walletId, body.endpoint);
      return privateJson({ ok: true as const });
    }),

    /** GET /wallets/push-config: the public VAPID key (not a secret), cached briefly. */
    pushConfig: (async () => {
      let vapidPublicKey: string | null = null;
      try {
        vapidPublicKey = getVapidPublicKey();
      } catch {
        vapidPublicKey = null;
      }
      const res = privateJson({ vapidPublicKey });
      res.headers.set("Cache-Control", "public, max-age=300");
      return res;
    }) as Handler,
  };
}

export type WalletApi = ReturnType<typeof createWalletApi>;

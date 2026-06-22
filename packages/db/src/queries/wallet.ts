import { and, asc, count, desc, eq, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../client";
import {
  denominations,
  drawResults,
  draws,
  pushSubscriptions,
  rateLimits,
  walletBonds,
  walletMatches,
  wallets,
} from "../schema";

/**
 * Wallet query module (Lane C). Every function takes a `Db`, so it runs on Neon HTTP in
 * production and PGlite in tests. Neon HTTP has no interactive transactions, so each operation
 * that must be atomic is a single statement.
 */

/** Draw states whose results count for matching. Scheduled draws have no results yet. */
const RESULT_STATUSES = ["published", "verified", "disputed"] as const;

/** Postgres array literal for `= ANY(...)`: one bound parameter instead of thousands. */
const intArray = (values: readonly number[]) => `{${values.map((v) => Math.trunc(v)).join(",")}}`;

type Rows<T> = { rows?: T[] } | T[];
function rowsOf<T>(result: unknown): T[] {
  const r = result as Rows<T>;
  return Array.isArray(r) ? r : (r.rows ?? []);
}

const iso = (d: Date | string | null | undefined): string | null =>
  d === null || d === undefined ? null : (d instanceof Date ? d : new Date(d)).toISOString();

// ---------------------------------------------------------------------------------------------
// Wallet lifecycle
// ---------------------------------------------------------------------------------------------

export interface NewWallet {
  id: string;
  tokenHash: string;
  syncCodeHash: string;
  locale?: string | null;
  timezone?: string | null;
  now: Date;
}

export async function insertWallet(db: Db, w: NewWallet): Promise<void> {
  await db.insert(wallets).values({
    id: w.id,
    tokenHash: w.tokenHash,
    syncCodeHash: w.syncCodeHash,
    locale: w.locale ?? null,
    timezone: w.timezone ?? null,
    createdAt: w.now,
    lastSeenAt: w.now,
  });
}

export interface WalletAuthRow {
  id: string;
  tokenHash: string;
  lastSeenAt: Date;
}

export async function findWalletForAuth(db: Db, walletId: string): Promise<WalletAuthRow | null> {
  const [row] = await db
    .select({ id: wallets.id, tokenHash: wallets.tokenHash, lastSeenAt: wallets.lastSeenAt })
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  return row ?? null;
}

export async function touchWallet(db: Db, walletId: string, now: Date): Promise<void> {
  await db.update(wallets).set({ lastSeenAt: now }).where(eq(wallets.id, walletId));
}

/**
 * Restore is one atomic statement: the wallet holding `syncCodeHash` gets a new token hash and
 * a new sync code hash, so the old token and the used code stop working at the same instant.
 */
export async function restoreWalletBySyncCode(
  db: Db,
  input: { syncCodeHash: string; newTokenHash: string; newSyncCodeHash: string; now: Date },
): Promise<string | null> {
  const [row] = await db
    .update(wallets)
    .set({ tokenHash: input.newTokenHash, syncCodeHash: input.newSyncCodeHash, lastSeenAt: input.now })
    .where(eq(wallets.syncCodeHash, input.syncCodeHash))
    .returning({ id: wallets.id });
  return row?.id ?? null;
}

export async function setSyncCodeHash(db: Db, walletId: string, syncCodeHash: string): Promise<boolean> {
  const rows = await db
    .update(wallets)
    .set({ syncCodeHash })
    .where(eq(wallets.id, walletId))
    .returning({ id: wallets.id });
  return rows.length > 0;
}

/** Deletes the wallet; bonds, matches and push subscriptions go with it (on delete cascade). */
export async function deleteWalletById(db: Db, walletId: string): Promise<boolean> {
  const rows = await db.delete(wallets).where(eq(wallets.id, walletId)).returning({ id: wallets.id });
  return rows.length > 0;
}

export interface WalletProfileRow {
  walletId: string;
  locale: string | null;
  timezone: string | null;
  createdAt: string;
  lastSeenAt: string;
  bondCount: number;
  matchCount: number;
  hasUnseenMatches: boolean;
}

export async function getWalletProfile(db: Db, walletId: string): Promise<WalletProfileRow | null> {
  const [w] = await db
    .select({
      id: wallets.id,
      locale: wallets.locale,
      timezone: wallets.timezone,
      createdAt: wallets.createdAt,
      lastSeenAt: wallets.lastSeenAt,
      bondCount: sql<number>`(select count(*)::int from ${walletBonds} where ${walletBonds.walletId} = ${wallets.id})`,
      matchCount: sql<number>`(select count(*)::int from ${walletMatches} where ${walletMatches.walletId} = ${wallets.id})`,
      unseen: sql<number>`(select count(*)::int from ${walletMatches} where ${walletMatches.walletId} = ${wallets.id} and ${walletMatches.seenAt} is null)`,
    })
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  if (!w) return null;
  return {
    walletId: w.id,
    locale: w.locale,
    timezone: w.timezone,
    createdAt: iso(w.createdAt)!,
    lastSeenAt: iso(w.lastSeenAt)!,
    bondCount: Number(w.bondCount),
    matchCount: Number(w.matchCount),
    hasUnseenMatches: Number(w.unseen) > 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Bonds
// ---------------------------------------------------------------------------------------------

export async function denominationFaceValues(db: Db): Promise<Record<string, number>> {
  const rows = await db.select({ code: denominations.code, faceValue: denominations.faceValue }).from(denominations);
  return Object.fromEntries(rows.map((r) => [r.code, r.faceValue]));
}

export interface WalletBondRow {
  denominationCode: string;
  bondNumber: number;
  label: string | null;
  addedAt: string;
}

export async function listWalletBonds(db: Db, walletId: string): Promise<WalletBondRow[]> {
  const rows = await db
    .select()
    .from(walletBonds)
    .where(eq(walletBonds.walletId, walletId))
    .orderBy(asc(walletBonds.denominationCode), asc(walletBonds.bondNumber));
  return rows.map((r) => ({
    denominationCode: r.denominationCode,
    bondNumber: r.bondNumber,
    label: r.label,
    addedAt: iso(r.addedAt)!,
  }));
}

export async function countWalletBonds(db: Db, walletId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(walletBonds).where(eq(walletBonds.walletId, walletId));
  return Number(row?.n ?? 0);
}

export interface BondInput {
  denominationCode: string;
  bondNumber: number;
  label?: string | null;
}

/**
 * Upserts bonds. New rows count as `added`. With `updateLabels`, an existing bond takes the new
 * label when one is given (PUT semantics); otherwise existing bonds are left untouched (import).
 */
export async function upsertWalletBonds(
  db: Db,
  walletId: string,
  bonds: readonly BondInput[],
  options: { now: Date; updateLabels: boolean },
): Promise<{ added: number; numbers: number[] }> {
  if (bonds.length === 0) return { added: 0, numbers: [] };
  const values = bonds.map((b) => ({
    walletId,
    denominationCode: b.denominationCode,
    bondNumber: b.bondNumber,
    label: b.label ?? null,
    addedAt: options.now,
  }));
  let added = 0;
  // Chunked to stay well below the 65,535 bind parameter limit (5 per row).
  for (let i = 0; i < values.length; i += 2000) {
    const chunk = values.slice(i, i + 2000);
    const base = db.insert(walletBonds).values(chunk);
    const rows = options.updateLabels
      ? await base
          .onConflictDoUpdate({
            target: [walletBonds.walletId, walletBonds.denominationCode, walletBonds.bondNumber],
            set: { label: sql`coalesce(excluded.label, ${walletBonds.label})` },
          })
          .returning({ inserted: sql<boolean>`(xmax = 0)` })
      : await base.onConflictDoNothing().returning({ inserted: sql<boolean>`true` });
    added += rows.filter((r) => r.inserted === true || String(r.inserted) === "true").length;
  }
  return { added, numbers: [...new Set(bonds.map((b) => b.bondNumber))] };
}

export async function deleteWalletBond(
  db: Db,
  walletId: string,
  denominationCode: string,
  bondNumber: number,
): Promise<boolean> {
  const rows = await db
    .delete(walletBonds)
    .where(
      and(
        eq(walletBonds.walletId, walletId),
        eq(walletBonds.denominationCode, denominationCode),
        eq(walletBonds.bondNumber, bondNumber),
      ),
    )
    .returning({ n: walletBonds.bondNumber });
  if (rows.length === 0) return false;
  // A removed bond no longer counts as a win in this wallet.
  await db
    .delete(walletMatches)
    .where(
      and(
        eq(walletMatches.walletId, walletId),
        eq(walletMatches.bondNumber, bondNumber),
        sql`${walletMatches.drawId} in (select ${draws.id} from ${draws} where ${draws.denominationCode} = ${denominationCode})`,
      ),
    );
  return true;
}

// ---------------------------------------------------------------------------------------------
// Matching engine
// ---------------------------------------------------------------------------------------------

/** Prize for a tier: the draw's own table, else the reference structure effective that day, else 0. */
const prizeAmountSql = sql`coalesce(
  dp.amount_pkr,
  (select ps.amount_pkr from prize_structures ps
     where ps.denomination_code = d.denomination_code and ps.tier = dr.tier
       and ps.effective_from <= d.draw_date and (ps.effective_to is null or ps.effective_to >= d.draw_date)
     order by ps.effective_from desc limit 1),
  0)`;

const resultStatusesSql = sql.raw(RESULT_STATUSES.map((s) => `'${s}'`).join(","));

/**
 * All-time check for one wallet (on add). Matches found this way are history the user is looking
 * at right now, so they are stored as already notified and never trigger a push.
 */
export async function matchWalletBonds(
  db: Db,
  walletId: string,
  options: { now: Date; bondNumbers?: readonly number[] },
): Promise<number> {
  if (options.bondNumbers && options.bondNumbers.length === 0) return 0;
  const filter = options.bondNumbers
    ? sql`and wb.bond_number = any(${intArray(options.bondNumbers)}::int[])`
    : sql``;
  const result = await db.execute(sql`
    insert into wallet_matches (wallet_id, draw_id, bond_number, tier, amount_pkr, matched_at, notified_at)
    select wb.wallet_id, d.id, dr.bond_number, dr.tier, ${prizeAmountSql}, ${options.now}, ${options.now}
    from wallet_bonds wb
    join draw_results dr on dr.bond_number = wb.bond_number
    join draws d on d.id = dr.draw_id and d.denomination_code = wb.denomination_code
    left join draw_prizes dp on dp.draw_id = d.id and dp.tier = dr.tier
    where wb.wallet_id = ${walletId} and d.status in (${resultStatusesSql}) ${filter}
    on conflict do nothing
    returning draw_id`);
  return rowsOf(result).length;
}

export interface NewMatchRow {
  walletId: string;
  drawId: number;
  bondNumber: number;
  tier: number;
  amountPkr: number;
}

/**
 * Incremental matching for the `wallet-notify` job: every wallet bond against draws published or
 * updated since `since`. Idempotent (`on conflict do nothing`), so overlapping windows are safe.
 * New rows have `notified_at` null and are picked up by `pendingNotifications`.
 */
export async function matchRecentDraws(db: Db, input: { since: Date; now: Date }): Promise<NewMatchRow[]> {
  const result = await db.execute(sql`
    insert into wallet_matches (wallet_id, draw_id, bond_number, tier, amount_pkr, matched_at)
    select wb.wallet_id, d.id, dr.bond_number, dr.tier, ${prizeAmountSql}, ${input.now}
    from draws d
    join draw_results dr on dr.draw_id = d.id
    join wallet_bonds wb on wb.denomination_code = d.denomination_code and wb.bond_number = dr.bond_number
    left join draw_prizes dp on dp.draw_id = d.id and dp.tier = dr.tier
    where d.status in (${resultStatusesSql})
      and (d.updated_at >= ${input.since} or d.published_at >= ${input.since})
    on conflict do nothing
    returning wallet_id::text as "walletId", draw_id as "drawId", bond_number as "bondNumber",
              tier::int as tier, amount_pkr::float8 as "amountPkr"`);
  return rowsOf<NewMatchRow>(result).map((r) => ({
    walletId: String(r.walletId),
    drawId: Number(r.drawId),
    bondNumber: Number(r.bondNumber),
    tier: Number(r.tier),
    amountPkr: Number(r.amountPkr),
  }));
}

/**
 * Re-verified draws can change: drop matches whose number left the draw and fix tiers that moved.
 * Returns how many rows were corrected.
 */
export async function reconcileRecentMatches(db: Db, since: Date): Promise<number> {
  const removed = await db.execute(sql`
    delete from wallet_matches m using draws d
    where m.draw_id = d.id and d.updated_at >= ${since}
      and not exists (select 1 from draw_results dr where dr.draw_id = m.draw_id and dr.bond_number = m.bond_number)
    returning m.draw_id`);
  const retiered = await db.execute(sql`
    update wallet_matches m set tier = dr.tier, amount_pkr = coalesce(dp.amount_pkr, m.amount_pkr)
    from draws d, draw_results dr left join draw_prizes dp on dp.draw_id = dr.draw_id and dp.tier = dr.tier
    where m.draw_id = d.id and d.updated_at >= ${since}
      and dr.draw_id = m.draw_id and dr.bond_number = m.bond_number and dr.tier <> m.tier
    returning m.draw_id`);
  return rowsOf(removed).length + rowsOf(retiered).length;
}

export interface PendingNotification {
  walletId: string;
  drawId: number;
  bondNumber: number;
  tier: number;
  amountPkr: number;
  denominationCode: string;
  drawDate: string;
  locale: string | null;
}

export async function pendingNotifications(db: Db, limit = 2000): Promise<PendingNotification[]> {
  const rows = await db
    .select({
      walletId: walletMatches.walletId,
      drawId: walletMatches.drawId,
      bondNumber: walletMatches.bondNumber,
      tier: walletMatches.tier,
      amountPkr: walletMatches.amountPkr,
      denominationCode: draws.denominationCode,
      drawDate: draws.drawDate,
      locale: wallets.locale,
    })
    .from(walletMatches)
    .innerJoin(draws, eq(draws.id, walletMatches.drawId))
    .innerJoin(wallets, eq(wallets.id, walletMatches.walletId))
    .where(isNull(walletMatches.notifiedAt))
    .orderBy(asc(walletMatches.walletId), desc(draws.drawDate))
    .limit(limit);
  return rows.map((r) => ({ ...r, amountPkr: Number(r.amountPkr), drawDate: String(r.drawDate) }));
}

export async function markNotified(
  db: Db,
  keys: readonly { walletId: string; drawId: number; bondNumber: number }[],
  now: Date,
): Promise<void> {
  const byWallet = new Map<string, { drawId: number; bondNumber: number }[]>();
  for (const k of keys) {
    const list = byWallet.get(k.walletId) ?? [];
    list.push(k);
    byWallet.set(k.walletId, list);
  }
  for (const [walletId, list] of byWallet) {
    await db
      .update(walletMatches)
      .set({ notifiedAt: now })
      .where(and(eq(walletMatches.walletId, walletId), matchKeyFilter(list)));
  }
}

function matchKeyFilter(list: readonly { drawId: number; bondNumber: number }[]): SQL {
  return or(
    ...list.map((k) => and(eq(walletMatches.drawId, k.drawId), eq(walletMatches.bondNumber, k.bondNumber))),
  )!;
}

export interface WalletMatchRow {
  drawId: number;
  denominationCode: string;
  drawNumber: number | null;
  drawDate: string;
  bondNumber: number;
  tier: number;
  amountPkr: number;
  matchedAt: string;
  seenAt: string | null;
}

export async function listWalletMatches(db: Db, walletId: string): Promise<WalletMatchRow[]> {
  const rows = await db
    .select({
      drawId: walletMatches.drawId,
      denominationCode: draws.denominationCode,
      drawNumber: draws.drawNumber,
      drawDate: draws.drawDate,
      bondNumber: walletMatches.bondNumber,
      tier: walletMatches.tier,
      amountPkr: walletMatches.amountPkr,
      matchedAt: walletMatches.matchedAt,
      seenAt: walletMatches.seenAt,
    })
    .from(walletMatches)
    .innerJoin(draws, eq(draws.id, walletMatches.drawId))
    .where(eq(walletMatches.walletId, walletId))
    .orderBy(desc(draws.drawDate), asc(walletMatches.tier), asc(walletMatches.bondNumber));
  return rows.map((r) => ({
    ...r,
    drawDate: String(r.drawDate),
    amountPkr: Number(r.amountPkr),
    matchedAt: iso(r.matchedAt)!,
    seenAt: iso(r.seenAt),
  }));
}

export async function markWalletMatchesSeen(
  db: Db,
  walletId: string,
  options: { now: Date; matches?: readonly { drawId: number; bondNumber: number }[] },
): Promise<number> {
  if (options.matches && options.matches.length === 0) return 0;
  const rows = await db
    .update(walletMatches)
    .set({ seenAt: options.now })
    .where(
      and(
        eq(walletMatches.walletId, walletId),
        isNull(walletMatches.seenAt),
        options.matches ? matchKeyFilter(options.matches) : undefined,
      ),
    )
    .returning({ drawId: walletMatches.drawId });
  return rows.length;
}

// ---------------------------------------------------------------------------------------------
// Analytics inputs
// ---------------------------------------------------------------------------------------------

export async function walletHoldings(
  db: Db,
  walletId: string,
): Promise<{ denominationCode: string; count: number }[]> {
  const rows = await db
    .select({ denominationCode: walletBonds.denominationCode, count: count() })
    .from(walletBonds)
    .where(eq(walletBonds.walletId, walletId))
    .groupBy(walletBonds.denominationCode);
  return rows.map((r) => ({ denominationCode: r.denominationCode, count: Number(r.count) }));
}

export async function walletBondRefs(
  db: Db,
  walletId: string,
): Promise<{ denominationCode: string; bondNumber: number }[]> {
  return db
    .select({ denominationCode: walletBonds.denominationCode, bondNumber: walletBonds.bondNumber })
    .from(walletBonds)
    .where(eq(walletBonds.walletId, walletId));
}

/** Tier 1 and 2 numbers (a few thousand rows across all years) for near-miss detection. */
export async function topWinningNumbers(
  db: Db,
  denominationCodes: readonly string[],
  tiers: readonly number[] = [1, 2],
): Promise<{ drawId: number; drawDate: string; denominationCode: string; bondNumber: number; tier: number }[]> {
  if (denominationCodes.length === 0) return [];
  const rows = await db
    .select({
      drawId: draws.id,
      drawDate: draws.drawDate,
      denominationCode: draws.denominationCode,
      bondNumber: drawResults.bondNumber,
      tier: drawResults.tier,
    })
    .from(drawResults)
    .innerJoin(draws, eq(draws.id, drawResults.drawId))
    .where(
      and(
        inArray(draws.denominationCode, [...denominationCodes]),
        inArray(drawResults.tier, [...tiers]),
        inArray(draws.status, [...RESULT_STATUSES]),
      ),
    );
  return rows.map((r) => ({ ...r, drawDate: String(r.drawDate) }));
}

/** The prize table of the most recent draw that has one, per denomination. */
export async function latestPrizeTables(
  db: Db,
  denominationCodes: readonly string[],
): Promise<Record<string, { tier: number; amountPkr: number; winnersCount: number }[]>> {
  if (denominationCodes.length === 0) return {};
  const result = await db.execute(sql`
    select d.denomination_code as "denominationCode", dp.tier::int as tier,
           dp.amount_pkr::float8 as "amountPkr", dp.winners_count::int as "winnersCount"
    from draw_prizes dp
    join draws d on d.id = dp.draw_id
    where d.id in (
      select distinct on (d2.denomination_code) d2.id
      from draws d2
      where d2.denomination_code in (${sql.join(
        denominationCodes.map((c) => sql`${c}`),
        sql`, `,
      )})
        and exists (select 1 from draw_prizes p2 where p2.draw_id = d2.id)
      order by d2.denomination_code, d2.draw_date desc
    )
    order by d.denomination_code, dp.tier`);
  const out: Record<string, { tier: number; amountPkr: number; winnersCount: number }[]> = {};
  for (const r of rowsOf<{ denominationCode: string; tier: number; amountPkr: number; winnersCount: number }>(
    result,
  )) {
    (out[r.denominationCode] ??= []).push({
      tier: Number(r.tier),
      amountPkr: Number(r.amountPkr),
      winnersCount: Number(r.winnersCount),
    });
  }
  return out;
}

export async function upcomingDrawsFor(
  db: Db,
  denominationCodes: readonly string[],
  today: string,
  limit = 12,
): Promise<{ denominationCode: string; drawDate: string; city: string | null }[]> {
  if (denominationCodes.length === 0) return [];
  const rows = await db
    .select({ denominationCode: draws.denominationCode, drawDate: draws.drawDate, city: draws.city })
    .from(draws)
    .where(
      and(
        inArray(draws.denominationCode, [...denominationCodes]),
        eq(draws.status, "scheduled"),
        gte(draws.drawDate, today),
      ),
    )
    .orderBy(asc(draws.drawDate), asc(draws.denominationCode))
    .limit(limit);
  return rows.map((r) => ({ ...r, drawDate: String(r.drawDate) }));
}

// ---------------------------------------------------------------------------------------------
// Push subscriptions
// ---------------------------------------------------------------------------------------------

export interface PushSubscriptionRow {
  id: number;
  walletId: string;
  platform: string;
  endpoint: string;
  keys: Record<string, string> | null;
}

/** An endpoint belongs to one wallet: re-subscribing from another wallet moves it. */
export async function upsertPushSubscription(
  db: Db,
  walletId: string,
  sub: { platform: string; endpoint: string; keys?: Record<string, string> | null },
  now: Date,
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({ walletId, platform: sub.platform, endpoint: sub.endpoint, keys: sub.keys ?? null, createdAt: now })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { walletId, platform: sub.platform, keys: sub.keys ?? null },
    });
}

export async function deletePushSubscription(db: Db, walletId: string, endpoint: string): Promise<boolean> {
  const rows = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.walletId, walletId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length > 0;
}

export async function deletePushSubscriptionById(db: Db, id: number): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
}

export async function pushSubscriptionsFor(db: Db, walletIds: readonly string[]): Promise<PushSubscriptionRow[]> {
  if (walletIds.length === 0) return [];
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.walletId, [...walletIds]));
  return rows.map((r) => ({
    id: r.id,
    walletId: r.walletId,
    platform: r.platform,
    endpoint: r.endpoint,
    keys: (r.keys as Record<string, string> | null) ?? null,
  }));
}

export async function countPushSubscriptions(db: Db, walletId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.walletId, walletId));
  return Number(row?.n ?? 0);
}

// ---------------------------------------------------------------------------------------------
// Rate limiting (rate_limits table, fixed window)
// ---------------------------------------------------------------------------------------------

// Structurally identical to `RateLimiter` in @bondcheck/shared (this package does not depend on it).
export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}
export interface RateLimiter {
  hit(rule: RateLimitRule, subject: string): Promise<RateLimitResult>;
}

/**
 * Postgres fixed-window `RateLimiter` (PLAN section 11). One upsert per hit, atomic on both
 * Neon HTTP and PGlite. `subject` must already be a hash; it is stored as part of the key.
 */
export function createPgRateLimiter(db: Db, now: () => Date = () => new Date()): RateLimiter {
  return {
    async hit(rule: RateLimitRule, subject: string): Promise<RateLimitResult> {
      const t = now().getTime();
      const windowMs = rule.windowSeconds * 1000;
      const windowStart = new Date(Math.floor(t / windowMs) * windowMs);
      const [row] = await db
        .insert(rateLimits)
        .values({ key: `${rule.name}:${subject}`, windowStart, count: 1 })
        .onConflictDoUpdate({
          target: [rateLimits.key, rateLimits.windowStart],
          set: { count: sql`${rateLimits.count} + 1` },
        })
        .returning({ count: rateLimits.count });
      const used = Number(row?.count ?? 1);
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - t) / 1000));
      return {
        allowed: used <= rule.limit,
        remaining: Math.max(0, rule.limit - used),
        retryAfterSeconds,
      };
    },
  };
}

/** Exposed for tests and the housekeeping job: matches by draw for one wallet. */
export async function matchesForDraw(db: Db, drawId: number) {
  return db.select().from(walletMatches).where(eq(walletMatches.drawId, drawId));
}

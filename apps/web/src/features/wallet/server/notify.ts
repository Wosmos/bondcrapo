import type { Job, JobContext, JobResult } from "@bondcheck/ingest";
import { formatBondNumber } from "@bondcheck/shared";
import * as q from "@bondcheck/db/queries/wallet";
import enMessages from "../../../../messages/en/wallet.json";
import urMessages from "../../../../messages/ur/wallet.json";

/**
 * `wallet-notify` (PLAN section 5.3): runs after `bonds-sync` commits and once a day as a safety
 * net. It matches every wallet bond against draws published or updated recently, corrects matches
 * of re-verified draws, then sends one push per wallet that has new wins. Idempotent: matching is
 * `on conflict do nothing` and a match is pushed at most once (`notified_at`).
 */

export interface PushMessage {
  title: string;
  body: string;
  /** Locale-prefixed path opened on tap. */
  url: string;
  tag: string;
}

export interface PushSubscriptionTarget {
  id: number;
  walletId: string;
  platform: string;
  endpoint: string;
  keys: Record<string, string> | null;
}

/** Sends one message to one subscription. `expired` deletes the subscription. */
export type PushSender = (sub: PushSubscriptionTarget, message: PushMessage) => Promise<{ ok: boolean; expired: boolean }>;

export interface WalletNotifyOptions {
  /** Null when VAPID is not configured: matches are still recorded and shown in the app. */
  sendPush: PushSender | null;
  /** How far back to look for new or re-verified draws (default 14 days). */
  windowDays?: number;
  /** Pending matches handled per invocation (default 2,000). */
  batchSize?: number;
}

type Messages = typeof enMessages;
const MESSAGES: Record<string, Messages> = { en: enMessages, ur: urMessages as Messages };

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

export function buildPushMessage(
  locale: string | null,
  wins: readonly { bondNumber: number; denominationCode: string; amountPkr: number; drawDate: string }[],
): PushMessage {
  const lang = locale === "ur" ? "ur" : "en";
  const m = MESSAGES[lang]!.push;
  // Western digits in both locales, as on the printed bonds.
  const nf = new Intl.NumberFormat(lang === "ur" ? "ur-PK-u-nu-latn" : "en-PK");
  const total = wins.reduce((n, w) => n + w.amountPkr, 0);
  const first = wins[0]!;
  const body =
    wins.length === 1
      ? fill(m.singleBody, {
          number: formatBondNumber(first.bondNumber),
          denomination: nf.format(Number(first.denominationCode.replace(/\D/g, ""))),
          amount: nf.format(first.amountPkr),
          date: first.drawDate,
        })
      : fill(m.manyBody, { count: nf.format(wins.length), amount: nf.format(total) });
  return { title: m.title, body, url: `/${lang}/my/wins`, tag: "bondcheck-wins" };
}

export function createWalletNotifyJob(options: WalletNotifyOptions): Job {
  const windowDays = options.windowDays ?? 14;
  const batchSize = options.batchSize ?? 2000;
  return {
    name: "wallet-notify",
    async run(ctx: JobContext): Promise<JobResult> {
      const now = ctx.now();
      const since = new Date(now.getTime() - windowDays * 24 * 3600 * 1000);
      const corrected = await q.reconcileRecentMatches(ctx.db, since);
      const created = await q.matchRecentDraws(ctx.db, { since, now });
      const pending = await q.pendingNotifications(ctx.db, batchSize);

      const byWallet = new Map<string, q.PendingNotification[]>();
      for (const p of pending) {
        const list = byWallet.get(p.walletId) ?? [];
        list.push(p);
        byWallet.set(p.walletId, list);
      }
      const subs = options.sendPush ? await q.pushSubscriptionsFor(ctx.db, [...byWallet.keys()]) : [];

      let pushed = 0;
      let failed = 0;
      let expired = 0;
      let walletsNotified = 0;
      let stoppedEarly = false;
      for (const [walletId, wins] of byWallet) {
        if (ctx.shouldStop()) {
          stoppedEarly = true;
          break;
        }
        const targets = subs.filter((s) => s.walletId === walletId && s.platform === "webpush");
        if (options.sendPush && targets.length) {
          const message = buildPushMessage(wins[0]!.locale, wins);
          for (const sub of targets) {
            try {
              const r = await options.sendPush(sub, message);
              if (r.ok) pushed++;
              else failed++;
              if (r.expired) {
                expired++;
                await q.deletePushSubscriptionById(ctx.db, sub.id);
              }
            } catch {
              failed++;
            }
          }
        }
        // Marked even without a subscription: the in-app "new win" badge covers those wallets.
        await q.markNotified(ctx.db, wins, now);
        walletsNotified++;
      }

      if (failed > 0) {
        await ctx.issue({
          severity: "warn",
          entity: "push",
          entityKey: "wallet-notify",
          message: `${failed} push deliveries failed`,
          details: { failed },
        });
      }
      const done = !stoppedEarly && pending.length < batchSize;
      return {
        done,
        cursor: null,
        status: options.sendPush ? "ok" : "partial",
        stats: {
          newMatches: created.length,
          corrected,
          walletsNotified,
          pushed,
          failed,
          expired,
          pushConfigured: options.sendPush !== null,
        },
      };
    },
  };
}

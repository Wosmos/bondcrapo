import { jobMap, type Job } from "@bondcheck/ingest";
import { createWalletNotifyJob, type PushSender } from "./server/notify";
import { sendWebPush, type VapidConfig } from "./server/web-push";

function vapidConfig(): VapidConfig | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
  return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT };
}

/** Web Push through VAPID. Expo remote push is deferred (ADR 0006), so other platforms are skipped. */
export function webPushSender(vapid: VapidConfig): PushSender {
  return async (sub, message) => {
    if (sub.platform !== "webpush" || !sub.keys?.p256dh || !sub.keys.auth) return { ok: false, expired: false };
    const r = await sendWebPush(
      { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      JSON.stringify(message),
      vapid,
      { topic: "wins", urgency: "high", ttlSeconds: 3 * 24 * 3600 },
    );
    return { ok: r.ok, expired: r.expired };
  };
}

/** The sender is resolved per run so a VAPID change takes effect without a redeploy of this module. */
const walletNotify: Job = {
  name: "wallet-notify",
  run(ctx, cursor) {
    const vapid = vapidConfig();
    return createWalletNotifyJob({ sendPush: vapid ? webPushSender(vapid) : null }).run(ctx, cursor);
  },
};

const walletJobList: Job[] = [walletNotify];

export const walletJobs = jobMap(walletJobList);

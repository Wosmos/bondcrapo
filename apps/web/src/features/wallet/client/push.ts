"use client";

import { ApiClient, subscribePush, unsubscribePush } from "@bondcheck/shared";
import { getPushConfig } from "@bondcheck/shared/api/wallet-extra";
import { base64UrlDecode } from "@bondcheck/shared/wallet/secrets";

const client = new ApiClient({ credentials: "same-origin" });

export type PushState = "unsupported" | "unconfigured" | "denied" | "off" | "on";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // Reuse the site's service worker when the shell has one (it imports sw-push.js); otherwise
  // register the push worker on its own. Same scope, so the subscription survives either way.
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const existing = await navigator.serviceWorker.getRegistration("/");
  const sub = existing ? await existing.pushManager.getSubscription() : null;
  return sub ? "on" : "off";
}

export class PushError extends Error {
  constructor(readonly reason: "unsupported" | "unconfigured" | "denied" | "failed") {
    super(reason);
  }
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new PushError("unsupported");
  const { data } = await client.call(getPushConfig);
  if (!data.vapidPublicKey) throw new PushError("unconfigured");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new PushError("denied");
  try {
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: new Uint8Array(base64UrlDecode(data.vapidPublicKey)),
      }));
    const json = sub.toJSON();
    await client.call(subscribePush, {
      body: { platform: "webpush", endpoint: sub.endpoint, keys: (json.keys ?? {}) as Record<string, string> },
    });
  } catch (error) {
    if (error instanceof PushError) throw error;
    throw new PushError("failed");
  }
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  try {
    await client.call(unsubscribePush, { body: { endpoint: sub.endpoint } });
  } finally {
    await sub.unsubscribe();
  }
}

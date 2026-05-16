import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getSchedule, listWalletBonds, listWalletMatches } from "@bondcheck/shared";
import { Platform } from "react-native";
import { api } from "./api";
import { denominationLabel } from "./denominations";
import { formatDate, formatPkr } from "./format";
import { matchKey, planDrawReminders, REMINDER_PREFIX, selectNewWins } from "./reminders";
import { readCredentials } from "./wallet-store";
import { createT } from "@/i18n/translate";
import type { AppLocale } from "@/i18n/types";

export const CHANNEL_DRAWS = "draws";
export const CHANNEL_WINS = "wins";
const NOTIFIED_KEY = "bondcheck.notifiedMatches.v1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureChannels(locale: AppLocale): Promise<void> {
  if (Platform.OS !== "android") return;
  const t = createT(locale);
  await Notifications.setNotificationChannelAsync(CHANNEL_DRAWS, {
    name: t("notifications.channelDraws"),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_WINS, {
    name: t("notifications.channelWins"),
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Asks for the notification permission (Android 13+); resolves true when granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

async function cancelDrawReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(REMINDER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Re-plans local reminders from the official schedule and the denominations in the wallet.
 * Safe to call often: it replaces the previous set. Returns how many were scheduled.
 */
export async function syncDrawReminders(locale: AppLocale, enabled: boolean): Promise<number> {
  await cancelDrawReminders();
  if (!enabled || !(await readCredentials())) return 0;
  const t = createT(locale);
  const client = api();
  const [{ data: bonds }, schedule] = await Promise.all([
    client.call(listWalletBonds),
    loadUpcomingSchedule(),
  ]);
  const owned = new Set(bonds.map((b) => b.denominationCode));
  const plan = planDrawReminders(schedule, owned);
  await ensureChannels(locale);
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: t("notifications.drawTodayTitle", { denomination: denominationLabel(r.denominationCode, t) }),
        body: r.city
          ? t("notifications.drawTodayBodyCity", { city: r.city, date: formatDate(r.drawDate, locale) })
          : t("notifications.drawTodayBody", { date: formatDate(r.drawDate, locale) }),
        data: { url: `/draws/${r.denominationCode}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL_DRAWS },
    });
  }
  return plan.length;
}

async function loadUpcomingSchedule() {
  const now = new Date();
  const years = [now.getFullYear()];
  if (now.getMonth() >= 9) years.push(now.getFullYear() + 1);
  const results = await Promise.allSettled(years.map((year) => api().call(getSchedule, { query: { year } })));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value.data.draws : []));
}

async function readNotified(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Looks for wins the server matched since the last check and posts one local notification.
 * Runs when the app opens and from the background task. Returns the number of new wins.
 */
export async function notifyNewWins(locale: AppLocale): Promise<number> {
  if (!(await readCredentials())) return 0;
  const { data: matches } = await api().call(listWalletMatches);
  const notified = await readNotified();
  const fresh = selectNewWins(matches, notified);
  if (fresh.length === 0) return 0;

  const t = createT(locale);
  const total = fresh.reduce((sum, m) => sum + m.amountPkr, 0);
  await ensureChannels(locale);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t("notifications.winTitle", { count: fresh.length }),
      body: t("notifications.winBody", { amount: formatPkr(total, locale) }),
      data: { url: "/wallet" },
    },
    trigger: { channelId: CHANNEL_WINS },
  });
  for (const m of fresh) notified.add(matchKey(m));
  // Keep the set bounded; old keys can never match again.
  await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified].slice(-2000)));
  return fresh.length;
}

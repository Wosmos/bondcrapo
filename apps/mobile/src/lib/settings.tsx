import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { Appearance } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import type { AppLocale } from "@/i18n/types";

const KEY = "bondcheck.settings.v1";

export const settingsSchema = z.object({
  locale: z.enum(["en", "ur"]),
  /** Light or dark; the first run starts from the phone's setting, then the choice is kept. */
  theme: z.enum(["light", "dark"]),
  /** Local reminders on the morning of each draw for denominations in the wallet. */
  drawReminders: z.boolean(),
  /** Background check for new wins (local notification when one is found). */
  winAlerts: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;

export function defaultSettings(deviceLanguage?: string | null, deviceScheme?: string | null): Settings {
  return {
    locale: deviceLanguage === "ur" ? "ur" : "en",
    theme: deviceScheme === "dark" ? "dark" : "light",
    drawReminders: false,
    winAlerts: false,
  };
}

/** Reads stored settings; anything missing or malformed falls back to defaults. */
export async function loadSettings(): Promise<Settings> {
  const fallback = defaultSettings(getLocales()[0]?.languageCode, Appearance.getColorScheme());
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as Record<string, unknown>;
    // Earlier versions offered "system"; it becomes whatever the phone shows now.
    if (stored.theme === "system") stored.theme = fallback.theme;
    const parsed = settingsSchema.partial().safeParse(stored);
    return parsed.success ? { ...fallback, ...parsed.data } : fallback;
  } catch {
    return fallback;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<Settings>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const [settings, setSettings] = useState(initial);
  useEffect(() => setSettings(initial), [initial]);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await saveSettings(next);
      return next;
    },
    [settings],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

export type { AppLocale };

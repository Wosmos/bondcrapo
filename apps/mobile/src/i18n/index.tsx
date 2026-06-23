import { reloadAppAsync } from "expo";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { I18nManager } from "react-native";
import { createT, type TFunction } from "./translate";
import { isRtlLocale, type AppLocale } from "./types";

interface I18nValue {
  locale: AppLocale;
  t: TFunction;
  rtl: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createT(locale), rtl: isRtlLocale(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** True when the native layout direction does not match the locale yet (needs a reload). */
export function needsDirectionChange(locale: AppLocale): boolean {
  return I18nManager.isRTL !== isRtlLocale(locale);
}

/**
 * Applies the layout direction for `locale`. React Native only flips layouts on start, so the
 * app reloads itself when the direction changes (Urdu is right to left).
 */
export async function applyLayoutDirection(locale: AppLocale, { reload = true } = {}): Promise<boolean> {
  if (!needsDirectionChange(locale)) return false;
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(isRtlLocale(locale));
  if (reload) await reloadAppAsync("Layout direction changed");
  return true;
}

export type { AppLocale, TFunction };

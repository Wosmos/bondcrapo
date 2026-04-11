"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  t as translate,
  getDirection,
  getFont,
  isRTL as checkRTL,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n";

const STORAGE_KEY = "bcp_locale";
const DEFAULT_LOCALE: Locale = "en";

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
      return stored as Locale;
    }
  } catch {
    // localStorage unavailable (SSR, privacy mode, etc.)
  }
  return DEFAULT_LOCALE;
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setLocaleState(getStoredLocale());
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }

    // Update html attributes for RTL/LTR and lang
    const html = document.documentElement;
    html.lang = newLocale;
    html.dir = getDirection(newLocale);

    // Update font on body if needed
    const font = getFont(newLocale);
    if (font !== "inherit") {
      document.body.style.fontFamily = `"${font}", sans-serif`;
    } else {
      document.body.style.fontFamily = "";
    }
  }, []);

  // Apply direction/lang on mount based on stored locale
  useEffect(() => {
    const stored = getStoredLocale();
    if (stored !== DEFAULT_LOCALE) {
      const html = document.documentElement;
      html.lang = stored;
      html.dir = getDirection(stored);
      const font = getFont(stored);
      if (font !== "inherit") {
        document.body.style.fontFamily = `"${font}", sans-serif`;
      }
    }
  }, []);

  const t = useMemo(
    () => (key: string) => translate(key, locale),
    [locale]
  );

  const dir = getDirection(locale);
  const isRTL = checkRTL(locale);

  return { locale, setLocale, t, dir, isRTL };
}

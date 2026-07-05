import { colorScheme as nativewindScheme } from "nativewind";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { dark, light, type Palette } from "./colors";
import type { AppLocale } from "@/i18n/types";

export type ThemePreference = "light" | "dark";

export interface Theme {
  scheme: "light" | "dark";
  colors: Palette;
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; pill: number };
  /** Font family for running text: Noto Nastaliq Urdu for Urdu, the system font otherwise. */
  fontFamily: (weight?: "regular" | "bold") => string | undefined;
  /** Nastaliq needs much taller lines than Latin text. */
  lineHeight: (fontSize: number) => number;
  locale: AppLocale;
}

const ThemeContext = createContext<Theme | null>(null);

const URDU_FONTS = { regular: "NotoNastaliqUrdu_400Regular", bold: "NotoNastaliqUrdu_700Bold" } as const;

export function buildTheme(scheme: "light" | "dark", locale: AppLocale): Theme {
  const urdu = locale === "ur";
  return {
    scheme,
    colors: scheme === "dark" ? dark : light,
    spacing: (n) => n * 4,
    radius: { sm: 8, md: 12, lg: 20, pill: 999 },
    fontFamily: (weight = "regular") => (urdu ? URDU_FONTS[weight] : undefined),
    lineHeight: (size) => Math.round(size * (urdu ? 1.9 : 1.35)),
    locale,
  };
}

export function ThemeProvider({
  preference,
  locale,
  children,
}: {
  preference: ThemePreference;
  locale: AppLocale;
  children: ReactNode;
}) {
  const scheme = preference;
  const theme = useMemo(() => buildTheme(scheme, locale), [scheme, locale]);
  // NativeWind's `dark:` classes and the global.css variables follow the same choice as `useTheme`.
  useEffect(() => nativewindScheme.set(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside ThemeProvider");
  return theme;
}

import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@bondcheck/shared";

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
export const RTL_LOCALES: readonly AppLocale[] = ["ur"];
export const dirFor = (locale: string): "rtl" | "ltr" =>
  (RTL_LOCALES as readonly string[]).includes(locale) ? "rtl" : "ltr";

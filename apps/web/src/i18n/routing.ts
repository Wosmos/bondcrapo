import { defineRouting } from "next-intl/routing";
// Constants entry only: the package index pulls zod and every contract into client bundles.
import { DEFAULT_LOCALE, LOCALES } from "@bondcheck/shared/constants";

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
export const RTL_LOCALES: readonly AppLocale[] = ["ur"];
export const dirFor = (locale: string): "rtl" | "ltr" =>
  (RTL_LOCALES as readonly string[]).includes(locale) ? "rtl" : "ltr";

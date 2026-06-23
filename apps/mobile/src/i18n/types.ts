export const APP_LOCALES = ["en", "ur"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const isRtlLocale = (locale: AppLocale): boolean => locale === "ur";

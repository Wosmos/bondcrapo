"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DENOMINATIONS } from "@bondcheck/shared";

/** Western digits in both locales (ADR 0005): numbers must match what is printed on the bond. */
export function intlLocale(locale: string): string {
  return locale === "ur" ? "ur-PK-u-nu-latn" : "en-PK";
}

export const FACE_VALUES: Record<string, number> = Object.fromEntries(DENOMINATIONS.map((d) => [d.code, d.faceValue]));
export const ACTIVE_DENOMINATIONS = DENOMINATIONS.filter((d) => d.active).map((d) => d.code);
export const ALL_DENOMINATIONS = DENOMINATIONS.map((d) => d.code);

export function useWalletFormat() {
  const locale = useLocale();
  const t = useTranslations("wallet");
  return useMemo(() => {
    const tag = intlLocale(locale);
    const number = new Intl.NumberFormat(tag);
    const money = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
    const decimal = new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // Draw dates are calendar dates: format in UTC so no time zone can shift the day.
    const date = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const dateTime = new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" });
    return {
      number: (n: number) => number.format(n),
      rupees: (n: number) => t("format.rupees", { amount: money.format(n) }),
      rupeesPrecise: (n: number) => t("format.rupees", { amount: decimal.format(n) }),
      date: (iso: string) => date.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)),
      dateTime: (iso: string) => dateTime.format(new Date(iso)),
      denomination: (code: string) => {
        const face = FACE_VALUES[code] ?? Number(code.replace(/\D/g, ""));
        const value = t("format.rupees", { amount: number.format(face) });
        return code.endsWith("P") ? t("format.premium", { value }) : value;
      },
      tier: (tier: number) => t(`format.tier${tier === 1 ? "1" : tier === 2 ? "2" : "3"}`),
    };
  }, [locale, t]);
}

export type WalletFormat = ReturnType<typeof useWalletFormat>;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { COUNTRIES, countryBySlug } from "@bondcheck/ingest/markets/countries";
import { routing } from "@/i18n/routing";
import { marketsMetadata } from "@/features/markets/lib/seo";
import { marketsT } from "@/features/markets/views/labels";
import { GoldRatePage } from "@/features/markets/views/GoldRatePage";

export const revalidate = 900;
export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; country: string }> };

export function generateStaticParams() {
  // Pakistan has its own static segment (gold-rate/pakistan) for the city pages.
  return routing.locales.flatMap((locale) => COUNTRIES.filter((c) => c.code !== "PK").map((c) => ({ locale, country: c.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, country } = await params;
  const config = countryBySlug(country);
  if (!config || config.code === "PK") return {};
  const t = await marketsT(locale);
  const name = t(`countries.${config.code}`);
  return marketsMetadata({
    locale,
    path: `/gold-rate/${config.slug}`,
    title: t("gold.metaTitle", { country: name, unit: t(`units.${config.primaryUnit}`) }),
    description: t("gold.metaDescription", { country: name, units: config.gold.units.map((u) => t(`units.${u}`)).join(", ") }),
  });
}

export default async function Page({ params }: Props) {
  const { locale, country } = await params;
  setRequestLocale(locale);
  const config = countryBySlug(country);
  if (!config || config.code === "PK") notFound();
  return <GoldRatePage locale={locale} config={config} />;
}

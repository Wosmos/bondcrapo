import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { countryByCode } from "@bondcheck/ingest/markets/countries";
import { routing } from "@/i18n/routing";
import { marketsMetadata } from "@/features/markets/lib/seo";
import { marketsT } from "@/features/markets/views/labels";
import { GoldRatePage } from "@/features/markets/views/GoldRatePage";

export const revalidate = 900;
export const dynamicParams = false;

const PK = countryByCode("PK")!;

type Props = { params: Promise<{ locale: string; city: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => (PK.cities ?? []).map((city) => ({ locale, city })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, city } = await params;
  if (!PK.cities?.includes(city)) return {};
  const t = await marketsT(locale);
  const name = t(`cities.${city}`);
  return marketsMetadata({
    locale,
    path: `/gold-rate/pakistan/${city}`,
    title: t("gold.metaTitleCity", { city: name }),
    description: t("gold.metaDescription", { country: name, units: [t("units.tola"), t("units.10g"), t("units.g")].join(", ") }),
  });
}

/** City pages: the Sarafa rate is national; the page says so and adds the city context. */
export default async function Page({ params }: Props) {
  const { locale, city } = await params;
  setRequestLocale(locale);
  if (!PK.cities?.includes(city)) notFound();
  return <GoldRatePage locale={locale} config={PK} city={city} />;
}

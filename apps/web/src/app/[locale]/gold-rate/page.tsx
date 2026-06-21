import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { countryByCode } from "@bondcheck/ingest/markets/countries";
import { marketsMetadata } from "@/features/markets/lib/seo";
import { marketsT } from "@/features/markets/views/labels";
import { GoldRatePage } from "@/features/markets/views/GoldRatePage";

export const revalidate = 900;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await marketsT(locale);
  const country = t("countries.PK");
  return marketsMetadata({
    locale,
    path: "/gold-rate",
    title: t("gold.metaTitle", { country, unit: t("units.tola") }),
    description: t("gold.metaDescription", { country, units: [t("units.tola"), t("units.10g"), t("units.g")].join(", ") }),
  });
}

/** Gold rate in Pakistan (the default country). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GoldRatePage locale={locale} config={countryByCode("PK")!} />;
}

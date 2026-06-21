import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { marketsMetadata } from "@/features/markets/lib/seo";
import { marketsT } from "@/features/markets/views/labels";
import { SilverRatePage } from "@/features/markets/views/MetalPages";

export const revalidate = 900;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await marketsT(locale);
  return marketsMetadata({ locale, path: "/silver-rate", title: t("silver.metaTitle"), description: t("silver.metaDescription") });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SilverRatePage locale={locale} />;
}

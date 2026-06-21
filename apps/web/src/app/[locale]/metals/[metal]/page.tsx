import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { marketsMetadata } from "@/features/markets/lib/seo";
import { METAL_SLUGS, metalFromSlug } from "@/features/markets/lib/slugs";
import { marketsT } from "@/features/markets/views/labels";
import { MetalPage } from "@/features/markets/views/MetalPages";

export const revalidate = 900;
export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; metal: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => Object.keys(METAL_SLUGS).map((metal) => ({ locale, metal })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, metal } = await params;
  const code = metalFromSlug(metal);
  if (!code) return {};
  const t = await marketsT(locale);
  const name = t(`metals.${code}`);
  return marketsMetadata({ locale, path: `/metals/${metal}`, title: t("metal.metaTitle", { metal: name }), description: t("metal.metaDescription", { metal: name }) });
}

export default async function Page({ params }: Props) {
  const { locale, metal } = await params;
  setRequestLocale(locale);
  const code = metalFromSlug(metal);
  if (!code) notFound();
  return <MetalPage locale={locale} metal={code} />;
}

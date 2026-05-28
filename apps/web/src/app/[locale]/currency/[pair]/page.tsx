import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { POPULAR_PKR_PAIRS } from "@bondcheck/ingest/markets/currencies";
import { routing } from "@/i18n/routing";
import { marketsMetadata } from "@/features/markets/lib/seo";
import { currencyNames } from "@/features/markets/lib/names";
import { pairSlug, parsePair } from "@/features/markets/lib/slugs";
import { marketsT } from "@/features/markets/views/labels";
import { PairPage } from "@/features/markets/views/CurrencyPages";

export const revalidate = 900;

type Props = { params: Promise<{ locale: string; pair: string }> };

/** Popular rupee pairs are prebuilt; any other valid pair renders on first request and is then cached. */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => POPULAR_PKR_PAIRS.map((c) => ({ locale, pair: pairSlug(c, "PKR") })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, pair } = await params;
  const p = parsePair(pair);
  if (!p) return {};
  const t = await marketsT(locale);
  const names = currencyNames(locale, [p.from, p.to]);
  return marketsMetadata({
    locale,
    path: `/currency/${pair}`,
    title: t("currency.pairMetaTitle", p),
    description: t("currency.pairMetaDescription", { fromName: names[p.from]!, toName: names[p.to]! }),
  });
}

export default async function Page({ params }: Props) {
  const { locale, pair } = await params;
  setRequestLocale(locale);
  const p = parsePair(pair);
  if (!p) notFound();
  return <PairPage locale={locale} from={p.from} to={p.to} />;
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RestoreView } from "@/features/wallet/components/RestoreView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "wallet.meta" });
  return { title: t("restoreTitle"), description: t("restoreDescription"), robots: { index: false, follow: false } };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RestoreView />;
}

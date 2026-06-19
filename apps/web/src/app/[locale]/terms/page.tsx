import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage, Sections, type Section } from "@/components/content/ContentPage";
import { LEGAL_UPDATED } from "@/components/content/legal";
import { formatDate } from "@/i18n/format";
import { paths } from "@/i18n/paths";
import { pageMetadata } from "@/i18n/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.terms" });
  return pageMetadata({ locale, path: paths.terms, title: t("metaTitle"), description: t("metaDescription") });
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common.terms" });
  return (
    <ContentPage
      title={t("title")}
      lead={t("lead")}
      meta={<p className="text-sm text-ink-2">{t("updated", { date: formatDate(locale, LEGAL_UPDATED, "long") })}</p>}
    >
      <Sections sections={t.raw("sections") as Section[]} />
    </ContentPage>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage, Sections, type Section } from "@/components/content/ContentPage";
import { Link } from "@/i18n/navigation";
import { paths } from "@/i18n/paths";
import { pageMetadata } from "@/i18n/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.about" });
  return pageMetadata({ locale, path: paths.about, title: t("metaTitle"), description: t("metaDescription") });
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common.about" });
  return (
    <ContentPage title={t("title")} lead={t("lead")}>
      <Sections sections={t.raw("sections") as Section[]} />
      <p>
        <Link href={paths.data}>{t("dataLink")}</Link>
      </p>
    </ContentPage>
  );
}

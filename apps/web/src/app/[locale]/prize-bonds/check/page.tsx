import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { Breadcrumbs } from "@/features/bonds/components/Breadcrumbs";
import { Checker } from "@/features/bonds/components/Checker";
import { alternates } from "@/features/bonds/seo";
import { ClientMessages } from "@/i18n/ClientMessages";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bonds.check" });
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: alternates(locale, "/prize-bonds/check") };
}

export default async function CheckPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "bonds" });
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ href: "/prize-bonds", label: t("nav.title") }, { label: t("check.title") }]} />
      <PageHeader title={t("check.title")} description={t("check.description")} />
      {/* The checker reads `?numbers=` on the client; the page itself stays static. */}
      <Suspense>
        <ClientMessages locale={locale} paths={["bonds.check", "bonds.common", "bonds.hub.coverageLink"]}>
          <Checker />
        </ClientMessages>
      </Suspense>
    </div>
  );
}

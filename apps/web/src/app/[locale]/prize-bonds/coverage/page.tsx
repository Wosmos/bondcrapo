import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { Breadcrumbs } from "@/features/bonds/components/Breadcrumbs";
import { CoverageTables } from "@/features/bonds/components/CoverageTables";
import { JsonLd } from "@/features/bonds/components/JsonLd";
import { Unavailable } from "@/features/bonds/components/Unavailable";
import { todayInPakistan } from "@/features/bonds/format";
import { alternates } from "@/features/bonds/seo";
import { attempt, loadCoverage } from "@/features/bonds/server/pages";

export const revalidate = 21600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bonds.coverage" });
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: alternates(locale, "/prize-bonds/coverage") };
}

export default async function CoveragePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "bonds" });
  const data = await attempt(() => loadCoverage(todayInPakistan()));
  const base = process.env.APP_BASE_URL ?? "";
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ href: "/prize-bonds", label: t("nav.title") }, { label: t("coverage.title") }]} />
      <PageHeader title={t("coverage.title")} description={t("coverage.description")} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: t("coverage.metaTitle"),
          description: t("coverage.metaDescription"),
          temporalCoverage: `2000/${todayInPakistan().slice(0, 4)}`,
          spatialCoverage: { "@type": "Country", name: "Pakistan" },
          isAccessibleForFree: true,
          distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${base}/api/v1/bonds/coverage` }],
        }}
      />
      {data.ok ? <CoverageTables rows={data.value} /> : <Unavailable retryHref={`/${locale}/prize-bonds/coverage`} />}
      <section aria-labelledby="method" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 id="method" className="text-lg font-semibold text-slate-900">{t("coverage.methodTitle")}</h2>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm text-slate-800">
          {(["1", "2", "3", "4"] as const).map((k) => (
            <li key={k}>{t(`coverage.method.${k}`)}</li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="attribution" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 id="attribution" className="text-lg font-semibold text-slate-900">{t("coverage.sourcesTitle")}</h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-800">
          <li>{t("coverage.sources.official")}</li>
          <li>{t("coverage.sources.pkprizebond")}</li>
          <li>{t("coverage.sources.prizeinfo")}</li>
        </ul>
      </section>
    </div>
  );
}

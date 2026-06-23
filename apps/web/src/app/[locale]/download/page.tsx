import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DownloadView, type DownloadState } from "@/features/download/DownloadView";
import { releaseSource } from "@/features/download/releases";
import { routing } from "@/i18n/routing";
import { serverEnv } from "@/platform/env";

/** Re-read the release every 5 minutes (same window as the release API cache). */
export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

function siteOrigin(): string | null {
  try {
    const base = serverEnv().APP_BASE_URL;
    return base ? new URL(base).origin : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "download" });
  const origin = siteOrigin();
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: {
      canonical: `/${locale}/download`,
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, `/${l}/download`]),
        ["x-default", `/${routing.defaultLocale}/download`],
      ]),
    },
    ...(origin ? { metadataBase: new URL(origin) } : {}),
  };
}

export default async function DownloadPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "download" });
  const lookup = await releaseSource().latest();
  const state: DownloadState =
    lookup.status === "ok"
      ? {
          status: "ok",
          version: lookup.release.version,
          publishedAt: lookup.release.publishedAt,
          notes: lookup.release.notes,
          downloads: lookup.release.downloads,
          manifest: lookup.release.manifest,
        }
      : lookup;
  const origin = siteOrigin();

  return (
    <div className="py-2">
      <DownloadView
        state={state}
        locale={locale}
        pageUrl={origin ? `${origin}/${locale}/download` : null}
        t={(key, values) => t(key as never, values as never)}
      />
    </div>
  );
}

import { AndroidLogoIcon, TicketIcon } from "@phosphor-icons/react/dist/ssr";
import type { AppManifest } from "@bondcheck/shared";
import { Badge, Card } from "@/components/ui";
import { CopyButton } from "./CopyButton";
import { QrCode } from "./QrCode";
import type { ReleaseAsset } from "./release-assets";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type DownloadState =
  | {
      status: "ok";
      version: string;
      publishedAt: string | null;
      notes: string;
      downloads: ReleaseAsset[];
      manifest: AppManifest | null;
    }
  | { status: "none" }
  | { status: "unavailable"; reason: "unconfigured" | "error" };

export function formatSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDay(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-PK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
    timeZone: "Asia/Karachi",
  }).format(d);
}

const ANDROID_ICON = <AndroidLogoIcon aria-hidden="true" weight="fill" className="size-5" />;

/**
 * The /download page body. Pure (no data fetching) so it renders the same on the server and in
 * tests from a fixture release.
 */
export function DownloadView({
  state,
  t,
  locale,
  pageUrl,
  qrUrl = null,
}: {
  state: DownloadState;
  t: Translate;
  locale: string;
  /** Absolute URL of this page for the QR code; omitted when the site origin is unknown. */
  pageUrl: string | null;
  /** What the QR code encodes: the direct download, so scanning saves the file. Defaults to the page. */
  qrUrl?: string | null;
}) {
  const apk = state.status === "ok" ? state.downloads.find((d) => d.platform === "android") ?? null : null;
  const others = state.status === "ok" ? state.downloads.filter((d) => d !== apk) : [];
  const size = formatSize(apk?.size);
  const released = state.status === "ok" ? formatDay(state.publishedAt, locale) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="overflow-hidden rounded-2xl bg-linear-to-br from-brand-strong to-ink px-6 py-8 text-white shadow-sm sm:px-10 sm:py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-4">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-white/15">
                <TicketIcon weight="fill" className="size-7" />
              </span>
              {state.status === "ok" ? (
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
                  <bdi dir="ltr">v{state.version}</bdi>
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("hero.title")}</h1>
            <p className="text-base leading-relaxed text-white/90">{t("hero.subtitle")}</p>
            {apk && state.status === "ok" ? (
              <div className="flex flex-col gap-2">
                <a
                  href={apk.url}
                  download={apk.name}
                  aria-label={t("cta.downloadA11y", { version: state.version, size: size ?? "" })}
                  className="inline-flex min-h-12 w-fit items-center gap-3 rounded-full bg-white px-6 text-base font-semibold text-brand-strong shadow-sm transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none"
                >
                  {ANDROID_ICON}
                  {t("cta.download")}
                  {size ? (
                    <span className="text-sm font-medium text-brand-strong">
                      <bdi dir="ltr">{size}</bdi>
                    </span>
                  ) : null}
                </a>
                <p className="text-sm text-white/80">{t("cta.direct")}</p>
              </div>
            ) : (
              <p role="status" className="rounded-lg bg-white/10 px-4 py-3 text-base">
                {state.status === "none"
                  ? t("state.none")
                  : state.status === "unavailable"
                    ? t(`state.${state.reason}`)
                    : t("state.none")}{" "}
                <a href={`/${locale}`} className="font-semibold underline underline-offset-4">
                  {t("state.openWebsite")}
                </a>
              </p>
            )}
          </div>
          {pageUrl ? (
            <div className="hidden flex-col items-center gap-3 rounded-2xl bg-surface p-5 text-center text-ink md:flex">
              <QrCode value={qrUrl ?? pageUrl} label={t("qr.alt", { url: pageUrl })} />
              <div className="max-w-48">
                <p className="text-sm font-semibold">{t("qr.title")}</p>
                <p className="text-xs text-ink-2">{t("qr.body")}</p>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {state.status === "ok" && apk ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={t("facts.label")}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-ink-2">{t("facts.version")}</dt>
              <dd className="font-medium text-ink">
                <bdi dir="ltr">{state.version}</bdi>
              </dd>
              <dt className="text-ink-2">{t("facts.released")}</dt>
              <dd className="font-medium text-ink">{released ?? t("facts.unknown")}</dd>
              <dt className="text-ink-2">{t("facts.size")}</dt>
              <dd className="font-medium text-ink">{size ? <bdi dir="ltr">{size}</bdi> : t("facts.unknown")}</dd>
              <dt className="text-ink-2">{t("facts.requires")}</dt>
              <dd className="font-medium text-ink">{t("facts.requiresValue")}</dd>
            </dl>
          </Card>
          <div className="lg:col-span-2">
            <Card title={t("checksum.title")}>
              <p className="mb-3 text-sm text-ink-2">{t("checksum.body")}</p>
              {apk.sha256 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <code dir="ltr" className="block flex-1 break-all rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-ink">
                    {apk.sha256}
                  </code>
                  <CopyButton value={apk.sha256} label={t("checksum.copy")} copiedLabel={t("checksum.copied")} />
                </div>
              ) : (
                <p className="text-sm text-ink-2">{t("checksum.missing")}</p>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("steps.title")}>
          <ol className="flex flex-col gap-4">
            {(["one", "two", "three", "four"] as const).map((step, i) => (
              <li key={step} className="flex gap-3">
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-success/15 text-sm font-semibold text-success">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm leading-relaxed text-ink">{t(`steps.${step}`)}</span>
              </li>
            ))}
          </ol>
        </Card>
        <div className="flex flex-col gap-6">
          <Card title={t("safety.title")}>
            <p className="text-sm leading-relaxed text-ink-2">{t("safety.body")}</p>
          </Card>
          <Card title={t("iphone.title")}>
            <p className="text-sm leading-relaxed text-ink-2">{t("iphone.body")}</p>
          </Card>
        </div>
      </div>

      {state.status === "ok" && state.notes.trim() ? (
        <Card title={t("notes.title", { version: state.version })}>
          <div className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{state.notes.trim()}</div>
        </Card>
      ) : null}

      {others.length > 0 ? (
        <Card title={t("other.title")}>
          <ul className="flex flex-col divide-y divide-line">
            {others.map((d) => (
              <li key={d.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-2">
                  <Badge tone="neutral">{t(`platform.${d.platform}`)}</Badge>
                  <a href={d.url} className="font-medium text-success underline-offset-4 hover:underline">
                    <bdi dir="ltr">{d.name}</bdi>
                  </a>
                </span>
                <span className="text-sm text-ink-2">
                  <bdi dir="ltr">{formatSize(d.size)}</bdi>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {pageUrl ? (
        <p className="text-center text-xs text-ink-2 md:hidden">
          <bdi dir="ltr">{pageUrl}</bdi>
        </p>
      ) : null}
    </div>
  );
}

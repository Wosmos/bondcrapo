import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BondCertificate } from "@/components/home/BondCertificate";
import { Rosette } from "@/components/home/Rosette";
import { LiveBoard } from "@/components/home/LiveBoard";
import { QuickCheck } from "@/components/home/QuickCheck";
import { Icon } from "@/components/shell/icons";
import { flattenMessages } from "@/i18n/client-messages";
import { formatAmount } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { paths } from "@/i18n/paths";
import { absoluteUrl, jsonLd, pageMetadata, SITE_NAME, siteOrigin } from "@/i18n/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.home" });
  return {
    ...pageMetadata({ locale, path: "/", title: t("metaTitle"), description: t("metaDescription") }),
    title: { absolute: t("metaTitle") },
  };
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common.home" });
  const other = locale === "ur" ? "en" : "ur";

  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: absoluteUrl(locale, "/"),
        inLanguage: locale,
        description: t("metaDescription"),
      },
      { "@type": "Organization", name: SITE_NAME, url: siteOrigin(), logo: `${siteOrigin()}/icons/icon-512.png` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />

      {/* Hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,color-mix(in_oklab,var(--gold)_16%,transparent),transparent_60%),radial-gradient(40rem_30rem_at_-10%_110%,color-mix(in_oklab,var(--brand)_12%,transparent),transparent_60%)]"
        />
        <Rosette className="pointer-events-none absolute -start-40 top-24 hidden size-[34rem] text-line lg:block" strokeWidth={0.35} layers={["outer", "inner"]} />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-surface/70 px-3 py-1 text-xs font-semibold tracking-wide text-gold-ink">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />
              {t("hero.eyebrow")}
            </p>
            <h1
              id="hero-title"
              className="font-display mt-5 text-[2.75rem] leading-[1.02] font-semibold tracking-tight text-ink sm:text-6xl lg:text-7xl ur:text-[2.25rem] ur:leading-[1.7] ur:sm:text-5xl ur:lg:text-[3.5rem]"
            >
              <span className="block">{t("hero.titleA")}</span>
              <span className="block">{t("hero.titleB")}</span>
              <span className="relative block w-fit text-brand">
                {t("hero.titleC")}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 300 18"
                  preserveAspectRatio="none"
                  className="absolute inset-x-0 -bottom-2 h-3 w-full text-gold"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                >
                  <path d="M4 12C60 4 120 3 170 7s90 6 126-2" />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2 text-pretty">{t("hero.lead")}</p>
            <p className="mt-2 text-sm">
              <Link href={paths.coverage} className="font-medium text-brand underline underline-offset-4 hover:text-brand-strong">
                {t("hero.coverage")}
              </Link>
            </p>

            <div className="mt-8 max-w-xl">
              <QuickCheck
                locale={locale}
                labels={{
                  legend: t("check.legend"),
                  number: t("check.number"),
                  numberHint: t("check.numberHint"),
                  denomination: t("check.denomination"),
                  any: t("check.any"),
                  submit: t("check.submit"),
                  rs: t.raw("board.rs") as string,
                  premium: t.raw("board.premium") as string,
                }}
              />
              <div className="mt-4 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <Link href={paths.check} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-ink hover:text-brand">
                  {t("check.many")}
                  <Icon name="arrow" className="size-4 rtl:-scale-x-100" />
                </Link>
                <Link
                  href={paths.wallet}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-surface-2"
                >
                  <Icon name="wallet" className="size-4.5" />
                  {t("check.wallet")}
                </Link>
              </div>
              <p className="mt-1 text-xs text-ink-2 sm:text-end">{t("check.walletHint")}</p>
            </div>
          </div>

          <div className="lg:ps-4">
            <BondCertificate
              label={t("certificate.label")}
              title={t("certificate.title")}
              amount={t("board.rs", { value: formatAmount(locale, 750) })}
              issuer={t("certificate.issuer")}
              serialLabel={t("certificate.serial")}
              stamp={t("certificate.stamp")}
            />
          </div>
        </div>
      </section>

      {/* Live board */}
      <section aria-labelledby="board-title" className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="board-title" className="font-display text-3xl font-semibold tracking-tight text-ink">
              {t("board.title")}
            </h2>
            <p className="mt-1 max-w-2xl text-ink-2">{t("board.subtitle")}</p>
          </div>
        </div>
        <LiveBoard locale={locale} labels={flattenMessages(t.raw("board") as Record<string, unknown>)} />
      </section>

      {/* How it works */}
      <section aria-labelledby="steps-title" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <h2 id="steps-title" className="font-display text-3xl font-semibold tracking-tight text-ink">
          {t("steps.title")}
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {(["one", "two", "three"] as const).map((step, i) => (
            <li key={step} className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6">
              <span
                aria-hidden="true"
                className="font-display absolute -end-2 -top-6 text-[7rem] leading-none font-semibold text-surface-2 select-none"
              >
                {i + 1}
              </span>
              <span className="relative inline-flex size-10 items-center justify-center rounded-full bg-ink font-mono text-sm font-semibold text-paper">
                0{i + 1}
              </span>
              <h3 className="relative mt-4 text-lg font-semibold text-ink">{t(`steps.${step}.title`)}</h3>
              <p className="relative mt-2 text-ink-2">{t(`steps.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features bento */}
      <section aria-labelledby="features-title" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <h2 id="features-title" className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-ink text-balance">
          {t("features.title")}
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-6">
          <article className="relative overflow-hidden rounded-3xl bg-[#0e2a1f] p-7 text-[#f5f1e6] ring-1 ring-line md:col-span-3 md:row-span-2">
            <Icon name="shield" className="size-8 text-[#e2b553]" />
            <h3 className="mt-5 text-2xl font-semibold">{t("features.wallet.title")}</h3>
            <p className="mt-3 max-w-md text-[#f5f1e6]/85">{t("features.wallet.body")}</p>
            <p aria-hidden="true" dir="ltr" className="mt-8 font-mono text-lg tracking-[0.3em] text-[#e2b553]">
              ABCD-EFGH-JKMN
            </p>
            <Rosette className="absolute -end-20 -bottom-24 size-80 text-[#f5f1e6]/10" strokeWidth={0.6} layers={["outer", "core"]} />
          </article>

          <article className="rounded-3xl border border-line bg-surface p-7 md:col-span-3">
            <Icon name="receipt" className="size-7 text-brand" />
            <h3 className="mt-4 text-xl font-semibold text-ink">{t("features.provenance.title")}</h3>
            <p className="mt-2 text-ink-2">{t("features.provenance.body")}</p>
            <ul aria-label={t("features.provenance.sample")} className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-ink-2">
              {(["file", "hash", "time"] as const).map((chip) => (
                <li key={chip} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5">
                  <Icon name="check" className="size-3.5 text-brand" />
                  {t(`features.provenance.chips.${chip}`)}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl border border-line bg-surface p-7 md:col-span-3">
            <Icon name="offline" className="size-7 text-brand" />
            <h3 className="mt-4 text-xl font-semibold text-ink">{t("features.offline.title")}</h3>
            <p className="mt-2 text-ink-2">{t("features.offline.body")}</p>
          </article>

          <article className="rounded-3xl border border-gold/50 bg-surface p-7 md:col-span-3">
            <Icon name="language" className="size-7 text-gold-ink" />
            <h3 lang={other} className="mt-4 text-xl leading-loose font-semibold text-ink">
              {t("features.urdu.title")}
            </h3>
            <p className="mt-2 text-ink-2">{t("features.urdu.body")}</p>
          </article>

          <article className="flex flex-col justify-between gap-6 rounded-3xl border border-line bg-surface-2 p-7 md:col-span-3">
            <div>
              <Icon name="phone" className="size-7 text-brand" />
              <h3 className="mt-4 text-xl font-semibold text-ink">{t("features.app.title")}</h3>
              <p className="mt-2 text-ink-2">{t("features.app.body")}</p>
            </div>
            <Link
              href={paths.download}
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-ink px-5 font-semibold text-paper hover:opacity-90"
            >
              <Icon name="download" className="size-4.5" />
              {t("features.app.cta")}
            </Link>
          </article>
        </div>
      </section>

      {/* Trust */}
      <section aria-labelledby="trust-title" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 border-y border-line py-10 md:grid-cols-[1fr_1.2fr] md:items-center">
          <h2 id="trust-title" className="font-display text-3xl font-semibold tracking-tight text-ink text-balance">
            {t("trust.title")}
          </h2>
          <div>
            <p className="text-ink-2">{t("trust.body")}</p>
            <Link href={paths.data} className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand hover:underline">
              {t("trust.sources")}
              <Icon name="arrow" className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section aria-labelledby="cta-title" className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-12 text-on-brand sm:px-12">
          <Rosette className="absolute -end-24 -top-24 size-96 text-on-brand/15" strokeWidth={0.5} layers={["outer", "inner", "core"]} />
          <div className="relative max-w-xl">
            <h2 id="cta-title" className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t("cta.title")}
            </h2>
            <p className="mt-3 text-on-brand/85">{t("cta.body")}</p>
            <Link
              href={paths.check}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-surface px-6 font-semibold text-ink hover:bg-paper"
            >
              {t("cta.button")}
              <Icon name="arrow" className="size-4.5 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

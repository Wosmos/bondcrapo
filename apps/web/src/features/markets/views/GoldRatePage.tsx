import { GRAMS_PER_TROY_OUNCE, gramsPerUnit, type WeightUnit } from "@bondcheck/shared";
import { COUNTRIES, type CountryConfig } from "@bondcheck/ingest/markets/countries";
import { DataTable, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { PriceChart } from "../components/PriceChart";
import {
  Breadcrumbs,
  Change,
  Faq,
  JsonLd,
  KindBadge,
  MarketsSubnav,
  Price,
  SampleNotice,
  SourceLine,
  Sources,
  Unavailable,
  Updated,
  surface,
} from "../components/bits";
import { formatDate, formatMoney, formatPercent } from "../lib/format";
import { breadcrumbJsonLd, faqJsonLd } from "../lib/seo";
import { loadLatestReported, loadLocalRates, loadMetalHistory, loadMetalsLatest } from "../server/data";
import type { LocalRates } from "../server/service";
import { changeLabels, chartLabels, kindLabels, marketsT, subnavLabels } from "./labels";

type Rate = LocalRates[number];

/** Reported beats derived; within a kind the newest wins. */
export function pickRate(rows: Rate[], metal: string, karat: number, unit: string): Rate | undefined {
  const matches = rows.filter((r) => r.metal === metal && r.karat === karat && r.unit === unit);
  return matches.find((r) => r.kind === "reported") ?? matches.find((r) => r.kind === "derived");
}

/** Multiplier from USD per ounce to price per `unit` of 24K (0.999), including the country premium. */
export function chartScale(config: CountryConfig, unit: WeightUnit, premiumPct = config.premiumPct): number {
  return (gramsPerUnit(unit) / GRAMS_PER_TROY_OUNCE) * 0.999 * (1 + premiumPct / 100);
}

export async function GoldRatePage({ locale, config, city }: { locale: string; config: CountryConfig; city?: string }) {
  const t = await marketsT(locale);
  const isPk = config.code === "PK";
  const [rates, spot, history, latestReported] = await Promise.all([
    loadLocalRates(config.code),
    loadMetalsLatest("USD"),
    loadMetalHistory("XAU", config.currency, "6m"),
    isPk ? loadLatestReported(config.code) : Promise.resolve(null),
  ]);
  const unit = config.primaryUnit;
  const unitName = t(`units.${unit}`);
  const countryName = t(`countries.${config.code}`);
  const cityName = city ? t(`cities.${city}`) : undefined;
  const path = isPk ? (city ? `/gold-rate/pakistan/${city}` : "/gold-rate") : `/gold-rate/${config.slug}`;

  const rows = rates.ok ? rates.data : [];
  const hero = pickRate(rows, "XAU", 24, unit);
  const parity = isPk ? rows.find((r) => r.metal === "XAU" && r.karat === 24 && r.unit === unit && r.kind === "derived" && r.source === "derived") : undefined;
  const premiumPct = hero?.kind === "reported" && parity ? (hero.price / parity.price - 1) * 100 : null;
  const gold = spot.ok ? spot.data.find((s) => s.metal === "XAU") : undefined;
  const scale = chartScale(config, unit);
  const kinds = kindLabels(t);
  // On a day the association has not reported yet, its newest rate is shown next to the estimate.
  const official = hero?.kind === "derived" && latestReported?.ok ? pickRate(latestReported.data, "XAU", 24, unit) : undefined;
  // An association rate three days older than the estimate is not today's price: say so instead.
  const officialStale = official && hero ? Date.parse(official.date) < Date.parse(hero.observedAt) - 3 * 86_400_000 : false;
  const reportLink = (r: Rate | undefined) => (r?.sourceUrl ? { url: r.sourceUrl, label: t("provenance.readReport") } : null);
  const date = hero?.date ?? rows[0]?.date;
  const faq = (t.raw(isPk ? "gold.faq.PK" : "gold.faq.other") as { q: string; a: string }[]).map((f) => ({
    q: f.q.replace("{country}", countryName).replace("{currency}", config.currency),
    a: f.a.replace("{country}", countryName).replace("{currency}", config.currency),
  }));
  const sample = rates.ok && rates.sample;
  const title = cityName ? t("gold.titleCity", { city: cityName }) : t("gold.title", { country: countryName });
  const unitsText = config.gold.units.map((u) => t(`units.${u}`)).join(", ");

  const columns = [
    {
      key: "karat",
      header: t("common.purity"),
      cell: (k: number) => <span className="font-semibold text-ink">{t("common.karat", { karat: k })}</span>,
    },
    ...config.gold.units.map((u) => ({
      key: u,
      header: t("common.perUnit", { unit: t(`units.${u}`) }),
      numeric: true,
      cell: (k: number) => {
        const r = pickRate(rows, "XAU", k, u);
        if (!r) return <span className="text-ink-2">-</span>;
        return (
          <span className="inline-flex flex-col items-end gap-0.5">
            <Price className="font-medium text-ink">{formatMoney(locale, r.currency, r.price, 0)}</Price>
            <span className="text-[11px] font-normal text-ink-2">{r.kind === "reported" ? kinds.reported : kinds.estimated}</span>
          </span>
        );
      },
    })),
  ];

  const silverUnits = config.silver.units.filter((u) => pickRate(rows, "XAG", 0, u));

  return (
    <article className="mx-auto max-w-5xl">
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: t("common.home"), path: "" },
          { name: t("gold.title", { country: countryName }), path: isPk ? "/gold-rate" : `/gold-rate/${config.slug}` },
          ...(cityName ? [{ name: title, path }] : []),
        ])}
      />
      <JsonLd data={faqJsonLd(faq)} />
      <Breadcrumbs
        label={t("common.breadcrumb")}
        items={[
          { name: t("common.home"), href: "/" },
          ...(cityName ? [{ name: t("gold.title", { country: countryName }), href: "/gold-rate" }] : []),
          { name: title },
        ]}
      />
      <MarketsSubnav current="gold" labels={subnavLabels(t)} />
      {sample ? <SampleNotice text={t("common.sample")} /> : null}
      <PageHeader title={title} description={t("gold.description", { units: unitsText })} />

      {!rates.ok || !hero ? (
        <Unavailable title={t("common.unavailableTitle")} description={t("common.unavailableBody")} />
      ) : (
        <>
          <section aria-labelledby="gold-hero" className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className={`${surface} relative overflow-hidden p-5 sm:p-6`}>
              <div aria-hidden="true" className="absolute -end-10 -top-10 size-40 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 blur-2xl" />
              <div className="relative flex flex-wrap items-center gap-2">
                <h2 id="gold-hero" className="text-sm font-medium text-ink-2">
                  {t("gold.heroLabel", { unit: unitName })}
                </h2>
                <KindBadge kind={hero.kind} labels={kinds} />
              </div>
              <p className="relative mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                <Price>{formatMoney(locale, hero.currency, hero.price, 0)}</Price>
              </p>
              <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {premiumPct !== null && parity ? (
                  <p className="text-sm text-ink-2">
                    {t("gold.parity")}: <Price className="font-medium">{formatMoney(locale, parity.currency, parity.price, 0)}</Price>
                    <span className="text-ink-2"> · </span>
                    {t("gold.premium", { pct: formatPercent(locale, premiumPct) })}
                  </p>
                ) : null}
              </div>
              <div className="relative mt-3">
                <Updated iso={hero.observedAt} locale={locale} label={t.raw("common.updated") as string} staleLabel={t("common.stale")} />
                {hero.kind === "reported" ? (
                  <SourceLine className="mt-1" label={t("provenance.source")} ids={[hero.source]} report={reportLink(hero)} />
                ) : (
                  <SourceLine className="mt-1" label={t("provenance.internationalPrice")} ids={spot.ok ? spot.sources : []} />
                )}
              </div>
              {official && officialStale ? (
                <div className="relative mt-4 rounded-lg border border-line bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
                  <p className="text-sm text-ink">{t("provenance.officialStale", { date: formatDate(locale, official.date, "long") })}</p>
                  <p className="mt-2">{t("provenance.associationsNote")}</p>
                </div>
              ) : official ? (
                <div className="relative mt-4 rounded-lg border border-line bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-ink">{t("provenance.officialTitle")}</h3>
                    <KindBadge kind="reported" labels={kinds} />
                  </div>
                  <p className="mt-1 text-xl font-semibold text-ink">
                    <Price>{formatMoney(locale, official.currency, official.price, 0)}</Price>
                    <span className="ms-1 text-sm font-normal text-ink-2">{t("common.perUnit", { unit: unitName })}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-2">{t("provenance.officialDate", { date: formatDate(locale, official.date, "long") })}</p>
                  <SourceLine className="mt-1" label={t("provenance.source")} ids={[official.source]} report={reportLink(official)} />
                  <p className="mt-2 text-xs leading-relaxed text-ink-2">{t("provenance.estimateBecause")}</p>
                  <p className="mt-2 text-xs leading-relaxed text-ink-2">{t("provenance.associationsNote")}</p>
                </div>
              ) : null}
            </div>

            <div className={`${surface} flex flex-col justify-between gap-3 p-5`}>
              <div>
                <p className="text-sm font-medium text-ink-2">
                  {t("common.spot")} <span className="text-ink-2">({t("common.perOunce")})</span>
                </p>
                {gold ? (
                  <>
                    <p className="mt-1 text-2xl font-semibold text-ink">
                      <Price>{formatMoney(locale, "USD", gold.pricePerOunce, 2)}</Price>
                    </p>
                    <Change pct={gold.change24hPct} text={t("common.sinceClose", { change: formatPercent(locale, gold.change24hPct ?? 0) })} labels={changeLabels(t)} />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-ink-2">-</p>
                )}
              </div>
              {isPk ? (
                <p className="text-xs leading-relaxed text-ink-2">{t("gold.parityHint")}</p>
              ) : (
                <p className="text-xs leading-relaxed text-ink-2">{t("common.estimateNote")}</p>
              )}
            </div>
          </section>

          <div className={`${surface} mt-4 p-2 sm:p-4`}>
            <DataTable
              caption={t("gold.tableCaption", { country: countryName, date: date ? formatDate(locale, date, "long") : "" })}
              columns={columns}
              rows={config.gold.karats}
              getRowKey={(k) => k}
            />
            <p className="mt-2 max-w-prose px-2 text-xs leading-relaxed text-ink-2 sm:px-0">{t("provenance.legend")}</p>
          </div>

          {silverUnits.length > 0 ? (
            <section aria-labelledby="silver-mini" className={`${surface} mt-4 p-4`}>
              <h2 id="silver-mini" className="text-base font-semibold text-ink">
                <Link href={isPk ? "/silver-rate" : "/metals/silver"} className="underline-offset-2 hover:underline">
                  {t("gold.silverTitle", { country: countryName })}
                </Link>
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {silverUnits.map((u) => {
                  const r = pickRate(rows, "XAG", 0, u)!;
                  return (
                    <div key={u} className="rounded-lg bg-surface-2 p-3">
                      <dt className="text-xs text-ink-2">{t("common.perUnit", { unit: t(`units.${u}`) })}</dt>
                      <dd className="mt-0.5 font-semibold text-ink">
                        <Price>{formatMoney(locale, r.currency, r.price, r.price < 100 ? 2 : 0)}</Price>
                        <span className="ms-2 text-[11px] font-normal text-ink-2">{r.kind === "reported" ? kinds.reported : kinds.estimated}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ) : null}
        </>
      )}

      {isPk && config.cities ? (
        <section aria-labelledby="gold-cities" className="mt-8">
          <h2 id="gold-cities" className="text-base font-semibold text-ink">
            {t("gold.cityLabel")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {config.cities.map((c) => (
              <li key={c}>
                <Link
                  href={`/gold-rate/pakistan/${c}`}
                  aria-current={c === city ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    c === city ? "bg-gold/15 font-semibold text-warning ring-1 ring-gold/50" : "bg-surface text-ink-2 ring-1 ring-line hover:bg-surface-2"
                  }`}
                >
                  {t(`cities.${c}`)}
                </Link>
              </li>
            ))}
          </ul>
          {cityName ? <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">{t("gold.cityNote", { city: cityName })}</p> : null}
        </section>
      ) : null}

      <section aria-labelledby="gold-chart" className={`${surface} mt-8 p-4 sm:p-6`}>
        <h2 id="gold-chart" className="mb-1 text-lg font-semibold text-ink">
          {t("gold.chartTitle")}
        </h2>
        <p className="mb-4 max-w-prose text-sm text-ink-2">{t("gold.chartNote", { currency: config.currency })}</p>
        <PriceChart
          locale={locale}
          subject={t("gold.chartSubject", { unit: unitName })}
          currency={config.currency}
          decimals={0}
          tone="gold"
          ranges={["1m", "6m", "1y", "5y", "max"]}
          initialRange="6m"
          initialPoints={history.ok ? history.data.points.map((p) => ({ date: p.date, value: p.close * scale })) : []}
          source={{ kind: "metal", metal: "XAU", currency: config.currency, scale }}
          labels={chartLabels(t)}
        />
      </section>

      <section aria-labelledby="gold-world" className="mt-8">
        <h2 id="gold-world" className="text-base font-semibold text-ink">
          {t("gold.otherCountries")}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {COUNTRIES.filter((c) => c.code !== config.code).map((c) => (
            <li key={c.code}>
              <Link
                href={c.code === "PK" ? "/gold-rate" : `/gold-rate/${c.slug}`}
                className="flex min-h-11 items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm text-ink ring-1 ring-line transition-colors hover:bg-warning/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span>{t(`countryNames.${c.code}`)}</span>
                <span className="text-xs text-ink-2">{c.currency}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Faq title={t("common.faq")} items={faq} />

      <Sources
        title={t("common.sources")}
        ids={[...new Set([...(rates.ok ? rates.sources : []), ...(spot.ok ? spot.sources : []), ...(history.ok ? history.sources : [])])]}
        note={
          isPk
            ? t("gold.pkMethod")
            : t("gold.otherMethod", {
                country: countryName,
                premium: config.premiumPct ? t("gold.premiumNote", { pct: formatPercent(locale, config.premiumPct, 0), note: t(`gold.premiumNotes.${config.code}`) }) : "",
              })
        }
      />
    </article>
  );
}

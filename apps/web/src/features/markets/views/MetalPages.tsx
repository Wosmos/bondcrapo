import { GRAMS_PER_TOLA, GRAMS_PER_TROY_OUNCE, METALS, type Metal } from "@bondcheck/shared";
import { COUNTRIES } from "@bondcheck/ingest/markets/countries";
import { DataTable, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { PriceChart } from "../components/PriceChart";
import { Breadcrumbs, Change, Faq, JsonLd, KindBadge, MarketsSubnav, Price, SampleNotice, Sources, Unavailable, Updated, surface } from "../components/bits";
import { formatDate, formatMoney, formatPercent } from "../lib/format";
import { currencyNames } from "../lib/names";
import { breadcrumbJsonLd, datasetJsonLd, faqJsonLd } from "../lib/seo";
import { SLUG_FOR_METAL } from "../lib/slugs";
import { loadFxLatest, loadLocalRates, loadMetalHistory, loadMetalsLatest } from "../server/data";
import { changeLabels, chartLabels, kindLabels, marketsT, subnavLabels } from "./labels";
import { pickRate } from "./GoldRatePage";

const TONE: Record<Metal, "gold" | "silver" | "platinum"> = { XAU: "gold", XAG: "silver", XPT: "platinum", XPD: "platinum" };

export async function SilverRatePage({ locale }: { locale: string }) {
  const t = await marketsT(locale);
  const others = COUNTRIES.filter((c) => c.code !== "PK");
  const [pk, history, ...world] = await Promise.all([
    loadLocalRates("PK"),
    loadMetalHistory("XAG", "PKR", "6m"),
    ...others.map((c) => loadLocalRates(c.code)),
  ]);
  const rows = pk.ok ? pk.data : [];
  const hero = pickRate(rows, "XAG", 0, "tola");
  const kinds = kindLabels(t);
  const faq = t.raw("silver.faq") as { q: string; a: string }[];
  const scale = (GRAMS_PER_TOLA / GRAMS_PER_TROY_OUNCE) * 0.999;
  const worldRows = others.flatMap((c, i) => {
    const r = world[i];
    const data = r && r.ok ? r.data : [];
    const g = pickRate(data, "XAG", 0, "g");
    if (!g) return [];
    return [{ code: c.code, currency: c.currency, g, kg: pickRate(data, "XAG", 0, "kg"), oz: pickRate(data, "XAG", 0, "oz") }];
  });

  return (
    <article className="mx-auto max-w-5xl">
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: t("common.home"), path: "" }, { name: t("silver.title"), path: "/silver-rate" }])} />
      <JsonLd data={faqJsonLd(faq)} />
      <Breadcrumbs label={t("common.breadcrumb")} items={[{ name: t("common.home"), href: "/" }, { name: t("silver.title") }]} />
      <MarketsSubnav current="silver" labels={subnavLabels(t)} />
      {pk.ok && pk.sample ? <SampleNotice text={t("common.sample")} /> : null}
      <PageHeader title={t("silver.title")} description={t("silver.description")} />

      {!hero ? (
        <Unavailable title={t("common.unavailableTitle")} description={t("common.unavailableBody")} />
      ) : (
        <section aria-labelledby="silver-hero" className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className={`${surface} relative overflow-hidden p-5 sm:p-6`}>
            <div aria-hidden="true" className="absolute -end-10 -top-10 size-40 rounded-full bg-gradient-to-br from-line to-line-strong/30 blur-2xl" />
            <div className="relative flex flex-wrap items-center gap-2">
              <h2 id="silver-hero" className="text-sm font-medium text-ink-2">
                {t("silver.heroLabel")}
              </h2>
              <KindBadge kind={hero.kind} labels={kinds} />
            </div>
            <p className="relative mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              <Price>{formatMoney(locale, "PKR", hero.price, 0)}</Price>
            </p>
            <div className="relative mt-3">
              <Updated iso={hero.observedAt} locale={locale} label={t.raw("common.updated") as string} staleLabel={t("common.stale")} />
            </div>
          </div>
          <div className={`${surface} p-2 sm:p-4`}>
            <DataTable
              caption={t("silver.tableCaption", { date: formatDate(locale, hero.date, "long") })}
              getRowKey={(u) => u}
              rows={["tola", "10g"].filter((u) => pickRate(rows, "XAG", 0, u))}
              columns={[
                { key: "unit", header: t("common.unit"), cell: (u: string) => t("common.perUnit", { unit: t(`units.${u}`) }) },
                {
                  key: "price",
                  header: t("common.price"),
                  numeric: true,
                  cell: (u: string) => {
                    const r = pickRate(rows, "XAG", 0, u)!;
                    return (
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <Price className="font-medium text-ink">{formatMoney(locale, "PKR", r.price, 0)}</Price>
                        <span className="text-[11px] text-ink-2">{r.kind === "reported" ? kinds.reported : kinds.estimated}</span>
                      </span>
                    );
                  },
                },
              ]}
            />
          </div>
        </section>
      )}

      {worldRows.length > 0 ? (
        <section aria-labelledby="silver-world" className={`${surface} mt-6 p-2 sm:p-4`}>
          <h2 id="silver-world" className="px-2 pt-2 text-lg font-semibold text-ink sm:px-0 sm:pt-0">
            {t("silver.worldTitle")}
          </h2>
          <DataTable
            caption={t("silver.worldCaption")}
            getRowKey={(r) => r.code}
            rows={worldRows}
            columns={[
              {
                key: "country",
                header: t("silver.country"),
                cell: (r) => (
                  <Link href={`/gold-rate/${COUNTRIES.find((c) => c.code === r.code)!.slug}`} className="underline-offset-2 hover:underline">
                    {t(`countryNames.${r.code}`)}
                  </Link>
                ),
              },
              { key: "g", header: t("common.perUnit", { unit: t("units.g") }), numeric: true, cell: (r) => <Price>{formatMoney(locale, r.currency, r.g.price, 2)}</Price> },
              {
                key: "big",
                header: `${t("common.perUnit", { unit: t("units.kg") })} / ${t("units.oz")}`,
                numeric: true,
                cell: (r) => {
                  const big = r.kg ?? r.oz;
                  return big ? <Price>{formatMoney(locale, r.currency, big.price, 0)}</Price> : "-";
                },
              },
            ]}
          />
          <p className="px-2 pb-2 text-xs text-ink-2 sm:px-0">{t("common.estimateNote")}</p>
        </section>
      ) : null}

      <section aria-labelledby="silver-chart" className={`${surface} mt-6 p-4 sm:p-6`}>
        <h2 id="silver-chart" className="mb-4 text-lg font-semibold text-ink">
          {t("silver.chartTitle")}
        </h2>
        <PriceChart
          locale={locale}
          subject={t("silver.chartSubject")}
          currency="PKR"
          decimals={0}
          tone="silver"
          ranges={["1m", "6m", "1y", "5y", "max"]}
          initialRange="6m"
          initialPoints={history.ok ? history.data.points.map((p) => ({ date: p.date, value: p.close * scale })) : []}
          source={{ kind: "metal", metal: "XAG", currency: "PKR", scale }}
          labels={chartLabels(t)}
        />
      </section>

      <Faq title={t("common.faq")} items={faq} />
      <Sources
        title={t("common.sources")}
        ids={[...new Set([...(pk.ok ? pk.sources : []), ...(history.ok ? history.sources : []), ...world.flatMap((w) => (w.ok ? w.sources : []))])]}
        note={t("common.estimateNote")}
      />
    </article>
  );
}

const TABLE_CURRENCIES = ["USD", "PKR", "AED", "SAR", "GBP", "EUR", "INR", "QAR", "KWD", "OMR", "BHD", "CAD", "AUD"];

export async function MetalPage({ locale, metal }: { locale: string; metal: Metal }) {
  const t = await marketsT(locale);
  const [spot, fx, history] = await Promise.all([loadMetalsLatest("USD"), loadFxLatest("USD"), loadMetalHistory(metal, "USD", "1y")]);
  const name = t(`metals.${metal}`);
  const s = spot.ok ? spot.data.find((x) => x.metal === metal) : undefined;
  const path = `/metals/${SLUG_FOR_METAL[metal]}`;
  const faq = t.raw("metal.faq") as { q: string; a: string }[];
  const names = currencyNames(locale, TABLE_CURRENCIES);
  const rows = s && fx.ok ? TABLE_CURRENCIES.filter((c) => fx.data.rates[c]).map((c) => ({ c, oz: s.pricePerOunce * fx.data.rates[c]! })) : [];

  return (
    <article className="mx-auto max-w-5xl">
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: t("common.home"), path: "" }, { name: t("metal.title", { metal: name }), path }])} />
      <JsonLd data={faqJsonLd(faq)} />
      {history.ok && history.data.points.length > 1 ? (
        <JsonLd
          data={datasetJsonLd({
            name: t("metal.chartTitle", { metal: name }),
            description: t("metal.description", { metal: name }),
            locale,
            path,
            sources: [],
            temporalCoverage: `${history.data.points[0]!.date}/${history.data.points.at(-1)!.date}`,
          })}
        />
      ) : null}
      <Breadcrumbs label={t("common.breadcrumb")} items={[{ name: t("common.home"), href: "/" }, { name: t("metal.title", { metal: name }) }]} />
      <MarketsSubnav current={metal === "XAU" ? "gold" : metal === "XAG" ? "silver" : "metals"} labels={subnavLabels(t)} />
      {spot.ok && spot.sample ? <SampleNotice text={t("common.sample")} /> : null}
      <PageHeader title={t("metal.title", { metal: name })} description={t("metal.description", { metal: name })} />

      {!s ? (
        <Unavailable title={t("common.unavailableTitle")} description={t("common.unavailableBody")} />
      ) : (
        <section aria-label={t("metal.title", { metal: name })} className="grid gap-4 sm:grid-cols-2">
          <div className={`${surface} p-5 sm:p-6`}>
            <p className="text-sm font-medium text-ink-2">
              {name} <span className="text-ink-2">({t("metal.perOunce")})</span>
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-ink">
              <Price>{formatMoney(locale, "USD", s.pricePerOunce, 2)}</Price>
            </p>
            <div className="mt-2">
              <Change pct={s.change24hPct} text={t("common.sinceClose", { change: formatPercent(locale, s.change24hPct ?? 0) })} labels={changeLabels(t)} />
            </div>
            <div className="mt-3">
              <Updated iso={s.observedAt} locale={locale} label={t.raw("common.updated") as string} staleLabel={t("common.stale")} />
            </div>
          </div>
          <div className={`${surface} p-5 sm:p-6`}>
            <p className="text-sm font-medium text-ink-2">
              {name} <span className="text-ink-2">({t("metal.perGram")})</span>
            </p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              <Price>{formatMoney(locale, "USD", s.pricePerOunce / GRAMS_PER_TROY_OUNCE, 2)}</Price>
            </p>
            {fx.ok && fx.data.rates.PKR ? (
              <p className="mt-2 text-lg text-ink">
                <Price>{formatMoney(locale, "PKR", (s.pricePerOunce * fx.data.rates.PKR) / GRAMS_PER_TROY_OUNCE, 0)}</Price>
              </p>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-ink-2">{t("metal.note")}</p>
          </div>
        </section>
      )}

      {rows.length > 0 && fx.ok ? (
        <section aria-labelledby="metal-currencies" className={`${surface} mt-6 p-2 sm:p-4`}>
          <h2 id="metal-currencies" className="px-2 pt-2 text-lg font-semibold text-ink sm:px-0 sm:pt-0">
            {t("metal.inCurrencies", { metal: name })}
          </h2>
          <DataTable
            caption={t("metal.tableCaption", { metal: name, date: formatDate(locale, fx.data.date, "long") })}
            getRowKey={(r) => r.c}
            rows={rows}
            columns={[
              {
                key: "c",
                header: t("common.currency"),
                cell: (r) => (
                  <span>
                    <span className="font-semibold text-ink">{r.c}</span> <span className="text-xs text-ink-2">{names[r.c]}</span>
                  </span>
                ),
              },
              { key: "oz", header: t("metal.perOunce"), numeric: true, cell: (r) => <Price>{formatMoney(locale, r.c, r.oz, r.oz >= 1000 ? 0 : 2)}</Price> },
              { key: "g", header: t("metal.perGram"), numeric: true, cell: (r) => <Price>{formatMoney(locale, r.c, r.oz / GRAMS_PER_TROY_OUNCE, 2)}</Price> },
            ]}
          />
        </section>
      ) : null}

      <section aria-labelledby="metal-chart" className={`${surface} mt-6 p-4 sm:p-6`}>
        <h2 id="metal-chart" className="mb-4 text-lg font-semibold text-ink">
          {t("metal.chartTitle", { metal: name })}
        </h2>
        <PriceChart
          locale={locale}
          subject={t("metal.chartSubject", { metal: name })}
          currency="USD"
          decimals={2}
          tone={TONE[metal]}
          ranges={["1m", "6m", "1y", "5y", "max"]}
          initialRange="1y"
          initialPoints={history.ok ? history.data.points.map((p) => ({ date: p.date, value: p.close })) : []}
          source={{ kind: "metal", metal, currency: "USD", scale: 1 }}
          labels={chartLabels(t)}
        />
      </section>

      <section aria-labelledby="other-metals" className="mt-8">
        <h2 id="other-metals" className="text-base font-semibold text-ink">
          {t("metal.otherMetals")}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METALS.filter((m) => m !== metal).map((m) => (
            <li key={m}>
              <Link
                href={`/metals/${SLUG_FOR_METAL[m]}`}
                className="flex min-h-11 items-center rounded-lg bg-surface px-3 text-sm font-medium text-ink ring-1 ring-line hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {t(`metals.${m}`)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Faq title={t("common.faq")} items={faq} />
      <Sources title={t("common.sources")} ids={[...new Set([...(spot.ok ? spot.sources : []), ...(fx.ok ? fx.sources : []), ...(history.ok ? history.sources : [])])]} />
    </article>
  );
}

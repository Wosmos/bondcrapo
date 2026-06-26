import { POPULAR_PKR_PAIRS } from "@bondcheck/ingest/markets/currencies";
import { DataTable, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { Converter, type ConverterLabels } from "../components/Converter";
import { PriceChart } from "../components/PriceChart";
import { Breadcrumbs, Faq, JsonLd, MarketsSubnav, Price, SampleNotice, Sources, Unavailable, Updated, surface } from "../components/bits";
import { formatDate, formatMoney, formatNumber } from "../lib/format";
import { currencyNames } from "../lib/names";
import { breadcrumbJsonLd, faqJsonLd } from "../lib/seo";
import { pairSlug } from "../lib/slugs";
import { loadFxHistory, loadFxLatest, loadPkrRates } from "../server/data";
import type { PkrRates } from "../server/service";
import { chartLabels, marketsT, subnavLabels, type MarketsT } from "./labels";

const POPULAR = [...POPULAR_PKR_PAIRS] as string[];

function converterLabels(t: MarketsT): ConverterLabels {
  return {
    title: t("converter.title"),
    amount: t("converter.amount"),
    from: t("converter.from"),
    to: t("converter.to"),
    swap: t("converter.swap"),
    result: t.raw("converter.result") as string,
    rate: t.raw("converter.rate") as string,
    asOf: t.raw("converter.asOf") as string,
    invalid: t("converter.invalid"),
    popular: t("converter.popular"),
    all: t("converter.all"),
  };
}

interface PkrRow {
  currency: string;
  open?: PkrRates[number];
  inter?: PkrRates[number];
}

function groupPkr(rows: PkrRates): PkrRow[] {
  const m = new Map<string, PkrRow>();
  for (const r of rows) {
    const cur = m.get(r.currency) ?? { currency: r.currency };
    if (r.kind === "open_market") cur.open = r;
    else cur.inter = r;
    m.set(r.currency, cur);
  }
  const rank = (c: string) => {
    const i = POPULAR.indexOf(c);
    return i < 0 ? 100 : i;
  };
  return [...m.values()].sort((a, b) => rank(a.currency) - rank(b.currency) || a.currency.localeCompare(b.currency));
}

const rate = (locale: string, v: number | undefined) => (v === undefined ? "-" : formatNumber(locale, v, v < 10 ? 4 : 2));

function PkrTable({ locale, t, rows, names }: { locale: string; t: MarketsT; rows: PkrRow[]; names: Record<string, string> }) {
  const cell = (v: number | undefined) => <Price className="text-ink">{rate(locale, v)}</Price>;
  return (
    <DataTable
      caption={t("currency.tableCaption")}
      getRowKey={(r) => r.currency}
      rows={rows}
      columns={[
        {
          key: "currency",
          header: t("currency.currencyCol"),
          cell: (r: PkrRow) => (
            <Link href={`/currency/${pairSlug(r.currency, "PKR")}`} className="inline-flex min-h-6 flex-col underline-offset-2 hover:underline">
              <span className="font-semibold text-ink">{r.currency}</span>
              <span className="text-xs text-ink-2">{names[r.currency]}</span>
            </Link>
          ),
        },
        { key: "ob", header: `${t("currency.openMarket")}: ${t("currency.buying")}`, numeric: true, cell: (r: PkrRow) => cell(r.open?.buy) },
        { key: "os", header: `${t("currency.openMarket")}: ${t("currency.selling")}`, numeric: true, cell: (r: PkrRow) => cell(r.open?.sell) },
        { key: "ib", header: `${t("currency.interbank")}: ${t("currency.buying")}`, numeric: true, cell: (r: PkrRow) => cell(r.inter?.buy) },
        { key: "is", header: `${t("currency.interbank")}: ${t("currency.selling")}`, numeric: true, cell: (r: PkrRow) => cell(r.inter?.sell) },
      ]}
    />
  );
}

export async function CurrencyPage({ locale }: { locale: string }) {
  const t = await marketsT(locale);
  const [pkr, fx, history] = await Promise.all([loadPkrRates(), loadFxLatest("USD"), loadFxHistory("USD", "PKR", "6m")]);
  const rows = pkr.ok ? groupPkr(pkr.data) : [];
  const names = currencyNames(locale, fx.ok ? Object.keys(fx.data.rates) : rows.map((r) => r.currency));
  const newest = pkr.ok ? pkr.data.reduce<string | null>((m, r) => (!m || r.observedAt > m ? r.observedAt : m), null) : null;
  const faq = t.raw("currency.faq") as { q: string; a: string }[];
  const sample = (pkr.ok && pkr.sample) || (fx.ok && fx.sample);

  return (
    <article className="mx-auto max-w-5xl">
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: t("common.home"), path: "" }, { name: t("currency.title"), path: "/currency" }])} />
      <JsonLd data={faqJsonLd(faq)} />
      <Breadcrumbs label={t("common.breadcrumb")} items={[{ name: t("common.home"), href: "/" }, { name: t("currency.title") }]} />
      <MarketsSubnav current="currency" labels={subnavLabels(t)} />
      {sample ? <SampleNotice text={t("common.sample")} /> : null}
      <PageHeader title={t("currency.title")} description={t("currency.description")} />

      {rows.length === 0 ? (
        <Unavailable title={t("common.unavailableTitle")} description={t("common.unavailableBody")} />
      ) : (
        <div className={`${surface} p-2 sm:p-4`}>
          <PkrTable locale={locale} t={t} rows={rows} names={names} />
          <div className="mt-3 flex flex-col gap-1 px-2 sm:px-0">
            {newest ? <Updated iso={newest} locale={locale} label={t.raw("common.updated") as string} staleLabel={t("common.stale")} /> : null}
            <p className="max-w-prose text-xs leading-relaxed text-ink-2">{t("currency.openNote")}</p>
          </div>
        </div>
      )}

      <div className="mt-6">
        {fx.ok ? (
          <Converter locale={locale} rates={fx.data.rates} date={fx.data.date} initialFrom="USD" initialTo="PKR" popular={[...POPULAR, "PKR"]} names={names} labels={converterLabels(t)} />
        ) : null}
      </div>

      <section aria-labelledby="usd-chart" className={`${surface} mt-6 p-4 sm:p-6`}>
        <h2 id="usd-chart" className="mb-4 text-lg font-semibold text-ink">
          {t("currency.chartTitle", { from: "USD", to: "PKR" })}
        </h2>
        <PriceChart
          locale={locale}
          subject={t("currency.chartSubject", { from: "USD", to: "PKR" })}
          currency={null}
          decimals={2}
          tone="currency"
          ranges={["1m", "6m", "1y", "max"]}
          initialRange="6m"
          initialPoints={history.ok ? history.data.points.map((p) => ({ date: p.date, value: p.rate })) : []}
          source={{ kind: "fx", base: "USD", quote: "PKR" }}
          labels={chartLabels(t)}
        />
      </section>

      <PopularPairs t={t} names={names} />
      <Faq title={t("common.faq")} items={faq} />
      <Sources
        title={t("common.sources")}
        ids={[...new Set([...(pkr.ok ? pkr.sources : []), ...(fx.ok ? fx.sources : []), ...(history.ok ? history.sources : [])])]}
      />
    </article>
  );
}

function PopularPairs({ t, names, exclude }: { t: MarketsT; names: Record<string, string>; exclude?: string }) {
  return (
    <section aria-labelledby="popular-pairs" className="mt-8">
      <h2 id="popular-pairs" className="text-base font-semibold text-ink">
        {t("currency.popular")}
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {POPULAR.filter((c) => c !== exclude).map((c) => (
          <li key={c}>
            <Link
              href={`/currency/${pairSlug(c, "PKR")}`}
              className="flex min-h-11 flex-col justify-center rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-line transition-colors hover:bg-info/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="font-semibold text-ink">
                <bdi dir="ltr">{c} → PKR</bdi>
              </span>
              <span className="truncate text-xs text-ink-2">{names[c] ?? c}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const QUICK = [1, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000];

export async function PairPage({ locale, from, to }: { locale: string; from: string; to: string }) {
  const t = await marketsT(locale);
  const foreign = to === "PKR" ? from : from === "PKR" ? to : null;
  const [fx, pkr, history] = await Promise.all([loadFxLatest("USD"), foreign ? loadPkrRates() : Promise.resolve(null), loadFxHistory(from, to, "6m")]);
  const names = currencyNames(locale, fx.ok ? Object.keys(fx.data.rates) : [from, to]);
  const ref = fx.ok && fx.data.rates[from] && fx.data.rates[to] ? fx.data.rates[to]! / fx.data.rates[from]! : null;
  const local = pkr && pkr.ok && foreign ? groupPkr(pkr.data).find((r) => r.currency === foreign) : undefined;
  const title = t("currency.pairTitle", { from, to });
  const path = `/currency/${pairSlug(from, to)}`;
  const faq = t.raw("currency.faq") as { q: string; a: string }[];
  const sample = fx.ok && fx.sample;

  return (
    <article className="mx-auto max-w-5xl">
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: t("common.home"), path: "" },
          { name: t("currency.title"), path: "/currency" },
          { name: title, path },
        ])}
      />
      <Breadcrumbs
        label={t("common.breadcrumb")}
        items={[{ name: t("common.home"), href: "/" }, { name: t("currency.title"), href: "/currency" }, { name: title }]}
      />
      <MarketsSubnav current="currency" labels={subnavLabels(t)} />
      {sample ? <SampleNotice text={t("common.sample")} /> : null}
      <PageHeader title={title} description={t("currency.pairDescription", { fromName: names[from] ?? from, toName: names[to] ?? to })} />

      {ref === null ? (
        <Unavailable title={t("common.unavailableTitle")} description={t("common.unavailableBody")} />
      ) : (
        <section aria-label={title} className="grid gap-4 md:grid-cols-3">
          <div className={`${surface} p-5 md:col-span-1`}>
            <h2 className="text-sm font-medium text-ink-2">{t("currency.reference")}</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
              <Price>
                1 {from} = {formatNumber(locale, ref, ref >= 100 ? 2 : 4)} {to}
              </Price>
            </p>
            <p className="mt-2 text-xs text-ink-2">
              {t("currency.referenceHint")} {fx.ok ? formatDate(locale, fx.data.date, "long") : ""}
            </p>
          </div>
          {foreign ? (
            <div className={`${surface} p-5 md:col-span-2`}>
              {local ? (
                <>
                <p className="mb-3 text-xs text-ink-2">{t("currency.rupeesFor", { code: foreign })}</p>
                <dl className="grid grid-cols-2 gap-4">
                  {(
                    [
                      ["openMarket", local.open],
                      ["interbank", local.inter],
                    ] as const
                  ).map(([k, q]) => (
                    <div key={k}>
                      <dt className="text-sm font-medium text-ink-2">{t(`currency.${k}`)}</dt>
                      <dd className="mt-2 space-y-1 text-sm">
                        <span className="flex justify-between gap-2">
                          <span className="text-ink-2">{t("currency.buying")}</span>
                          <Price className="font-semibold text-ink">{rate(locale, q?.buy)}</Price>
                        </span>
                        <span className="flex justify-between gap-2">
                          <span className="text-ink-2">{t("currency.selling")}</span>
                          <Price className="font-semibold text-ink">{rate(locale, q?.sell)}</Price>
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
                </>
              ) : (
                <p className="text-sm text-ink-2">{t("common.unavailableBody")}</p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-ink-2">{t("currency.openNote")}</p>
            </div>
          ) : (
            <p className={`${surface} p-5 text-sm text-ink-2 md:col-span-2`}>{t("currency.noPkr")}</p>
          )}
        </section>
      )}

      {fx.ok ? (
        <div className="mt-6">
          <Converter locale={locale} rates={fx.data.rates} date={fx.data.date} initialFrom={from} initialTo={to} popular={[...POPULAR, "PKR"]} names={names} labels={converterLabels(t)} />
        </div>
      ) : null}

      <section aria-labelledby="pair-chart" className={`${surface} mt-6 p-4 sm:p-6`}>
        <h2 id="pair-chart" className="mb-4 text-lg font-semibold text-ink">
          {t("currency.chartTitle", { from, to })}
        </h2>
        <PriceChart
          locale={locale}
          subject={t("currency.chartSubject", { from, to })}
          currency={null}
          decimals={ref !== null && ref < 10 ? 4 : 2}
          tone="currency"
          ranges={["1m", "6m", "1y", "max"]}
          initialRange="6m"
          initialPoints={history.ok ? history.data.points.map((p) => ({ date: p.date, value: p.rate })) : []}
          source={{ kind: "fx", base: from, quote: to }}
          labels={chartLabels(t)}
        />
      </section>

      {ref !== null && fx.ok ? (
        <section className={`${surface} mt-6 p-2 sm:p-4`}>
          <DataTable
            caption={t("currency.quickCaption", { from, to, date: formatDate(locale, fx.data.date, "long") })}
            getRowKey={(a) => a}
            rows={QUICK}
            columns={[
              { key: "from", header: from, numeric: true, cell: (a: number) => <Price>{formatNumber(locale, a, 0)}</Price> },
              {
                key: "to",
                header: to,
                numeric: true,
                cell: (a: number) => <Price className="font-medium text-ink">{to === "PKR" ? formatMoney(locale, "PKR", a * ref, 2) : formatNumber(locale, a * ref, 2)}</Price>,
              },
            ]}
          />
        </section>
      ) : null}

      <p className="mt-6">
        <Link href={`/currency/${pairSlug(to, from)}`} className="font-medium text-info underline underline-offset-2">
          {t("currency.reverse", { from, to })}
        </Link>
      </p>
      <PopularPairs t={t} names={names} exclude={from} />
      <Faq title={t("common.faq")} items={faq} />
      <Sources
        title={t("common.sources")}
        ids={[...new Set([...(fx.ok ? fx.sources : []), ...(pkr && pkr.ok ? pkr.sources : []), ...(history.ok ? history.sources : [])])]}
      />
    </article>
  );
}

import { useLocale, useTranslations } from "next-intl";
import type { CoverageRow } from "@bondcheck/db/queries/bonds";
import { formatNumber } from "../format";
import { DISPLAY_ORDER } from "../labels";

const KEYS = ["expected", "full", "top", "none", "verified", "disputed"] as const;

export function CoverageTables({ rows }: { rows: CoverageRow[] }) {
  const t = useTranslations("bonds");
  const locale = useLocale();
  const codes = DISPLAY_ORDER.filter((c) => rows.some((r) => r.denominationCode === c));
  const n = (v: number) => formatNumber(v, locale);
  const th = "px-3 py-2 font-semibold text-slate-700";

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="coverage-summary">
        <h2 id="coverage-summary" className="mb-2 text-lg font-semibold text-slate-900">
          {t("coverage.summaryTitle")}
        </h2>
        <div tabIndex={0} role="region" aria-label={t("coverage.summaryCaption")} className="overflow-x-auto rounded-lg border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-slate-900">
          <table className="w-full border-collapse text-sm">
            <caption className="p-3 text-start text-sm font-medium text-slate-700">{t("coverage.summaryCaption")}</caption>
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50">
                <th scope="col" className={`${th} text-start`}>{t("coverage.columns.denomination")}</th>
                <th scope="col" className={`${th} text-start`}>{t("coverage.columns.years")}</th>
                {KEYS.map((k) => (
                  <th key={k} scope="col" className={`${th} text-end`}>{t(`coverage.columns.${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const mine = rows.filter((r) => r.denominationCode === code);
                const active = mine.filter((r) => r.expected > 0);
                const sum = (k: (typeof KEYS)[number]) => mine.reduce((a, r) => a + r[k], 0);
                return (
                  <tr key={code} className="border-b border-slate-100">
                    <th scope="row" className="px-3 py-2 text-start font-medium">{t(`common.denomination.${code}`)}</th>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {active.length ? <bdi dir="ltr">{`${active[0]!.year}–${active[active.length - 1]!.year}`}</bdi> : t("coverage.noDraws")}
                    </td>
                    {KEYS.map((k) => (
                      <td key={k} className="px-3 py-2 text-end tabular-nums">{n(sum(k))}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="coverage-detail">
        <h2 id="coverage-detail" className="mb-2 text-lg font-semibold text-slate-900">
          {t("coverage.detailTitle")}
        </h2>
        <p className="mb-3 text-sm text-slate-600">{t("coverage.noSource")}</p>
        <div className="flex flex-col gap-3">
          {codes.map((code) => {
            const mine = rows.filter((r) => r.denominationCode === code && (r.expected > 0 || r.year === 1999));
            const bond = t(`common.denomination.${code}`);
            return (
              <details key={code} className="rounded-lg border border-slate-200 bg-white">
                <summary className="min-h-11 cursor-pointer px-4 py-3 font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-900">
                  {bond}
                </summary>
                <div tabIndex={0} role="region" aria-label={t("coverage.detailCaption", { bond })} className="overflow-x-auto border-t border-slate-200 focus-visible:outline-2 focus-visible:outline-slate-900">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">{t("coverage.detailCaption", { bond })}</caption>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th scope="col" className={`${th} text-start`}>{t("coverage.columns.year")}</th>
                        {KEYS.map((k) => (
                          <th key={k} scope="col" className={`${th} text-end`}>{t(`coverage.columns.${k}`)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mine.map((r) => (
                        <tr key={r.year} className="border-b border-slate-100">
                          <th scope="row" className="px-3 py-1.5 text-start font-normal tabular-nums">{r.year}</th>
                          {KEYS.map((k) => (
                            <td key={k} className="px-3 py-1.5 text-end tabular-nums">{n(r[k])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}

import { useLocale, useTranslations } from "next-intl";
import type { CoverageRow } from "@bondcheck/db/queries/bonds";
import { DataTable } from "@/components/ui";
import { formatNumber } from "../format";
import { DISPLAY_ORDER } from "../labels";

const KEYS = ["expected", "full", "top", "none", "verified", "disputed"] as const;

export function CoverageTables({ rows }: { rows: CoverageRow[] }) {
  const t = useTranslations("bonds");
  const locale = useLocale();
  const codes = DISPLAY_ORDER.filter((c) => rows.some((r) => r.denominationCode === c));
  const n = (v: number) => formatNumber(v, locale);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="coverage-summary">
        <h2 id="coverage-summary" className="mb-2 text-lg font-semibold text-ink">
          {t("coverage.summaryTitle")}
        </h2>
        <DataTable
          caption={t("coverage.summaryCaption")}
          rows={codes}
          getRowKey={(code) => code}
          fileName="bondcheck-coverage.csv"
          columns={[
            { key: "denomination", header: t("coverage.columns.denomination"), cell: (code) => <span className="font-medium">{t(`common.denomination.${code}`)}</span> },
            {
              key: "years",
              header: t("coverage.columns.years"),
              cell: (code) => {
                const active = rows.filter((r) => r.denominationCode === code && r.expected > 0);
                return active.length ? <bdi dir="ltr" className="whitespace-nowrap">{`${active[0]!.year}–${active[active.length - 1]!.year}`}</bdi> : t("coverage.noDraws");
              },
            },
            ...KEYS.map((k) => ({
              key: k,
              header: t(`coverage.columns.${k}`),
              numeric: true,
              value: (code: string) => rows.filter((r) => r.denominationCode === code).reduce((a, r) => a + r[k], 0),
              cell: (code: string) => n(rows.filter((r) => r.denominationCode === code).reduce((a, r) => a + r[k], 0)),
            })),
          ]}
        />
      </section>

      <section aria-labelledby="coverage-detail">
        <h2 id="coverage-detail" className="mb-2 text-lg font-semibold text-ink">
          {t("coverage.detailTitle")}
        </h2>
        <p className="mb-3 text-sm text-ink-2">{t("coverage.noSource")}</p>
        <div className="flex flex-col gap-3">
          {codes.map((code) => {
            const mine = rows.filter((r) => r.denominationCode === code && (r.expected > 0 || r.year === 1999));
            const bond = t(`common.denomination.${code}`);
            return (
              <details key={code} className="rounded-lg border border-line bg-surface">
                <summary className="min-h-11 cursor-pointer px-4 py-3 font-medium text-ink focus-visible:outline-2 focus-visible:outline-focus">
                  {bond}
                </summary>
                <div className="border-t border-line p-3">
                  <DataTable
                    caption={t("coverage.detailCaption", { bond })}
                    rows={mine}
                    getRowKey={(r) => r.year}
                    fileName={`bondcheck-coverage-${code}.csv`}
                    columns={[
                      { key: "year", header: t("coverage.columns.year"), value: (r) => r.year, cell: (r) => <span className="tabular-nums">{r.year}</span> },
                      ...KEYS.map((k) => ({ key: k, header: t(`coverage.columns.${k}`), numeric: true, value: (r: CoverageRow) => r[k], cell: (r: CoverageRow) => n(r[k]) })),
                    ]}
                  />
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}

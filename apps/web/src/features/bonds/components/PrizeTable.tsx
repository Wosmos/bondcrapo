import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "../format";

export interface PrizeRow {
  tier: number;
  amountPkr: number;
  winnersCount: number;
  inferred: boolean;
}

/** Prize amounts and winners per series, with reference amounts marked in text. */
export function PrizeTable({ prizes, caption }: { prizes: PrizeRow[]; caption: string }) {
  const t = useTranslations("bonds");
  const locale = useLocale();
  const anyInferred = prizes.some((p) => p.inferred);
  return (
    <div>
      <div tabIndex={0} role="region" aria-label={caption} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-focus">
        <table className="w-full border-collapse text-sm">
          <caption className="pb-2 text-start text-sm font-medium text-ink-2">{caption}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-3 py-2 text-start font-semibold text-ink-2">{t("draw.prizeColumns.tier")}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold text-ink-2">{t("draw.prizeColumns.amount")}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold text-ink-2">{t("draw.prizeColumns.winners")}</th>
            </tr>
          </thead>
          <tbody>
            {prizes.map((p) => (
              <tr key={p.tier} className="border-b border-line">
                <th scope="row" className="px-3 py-2 text-start font-medium text-ink">{t(`common.tier.${p.tier}`)}</th>
                <td className="px-3 py-2 text-end tabular-nums">
                  <bdi>{t("common.rs", { amount: formatNumber(p.amountPkr, locale) })}</bdi>
                  {p.inferred ? <span className="ms-1 text-xs text-ink-2">({t("draw.reference")})</span> : null}
                </td>
                <td className="px-3 py-2 text-end tabular-nums">{formatNumber(p.winnersCount, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anyInferred ? <p className="mt-2 text-xs text-ink-2">{t("common.estimatedNote")}</p> : null}
    </div>
  );
}

import { useLocale, useTranslations } from "next-intl";
import { DataTable } from "@/components/ui";
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
      <DataTable
        caption={caption}
        rows={prizes}
        getRowKey={(p) => p.tier}
        fileName="bondcheck-prizes.csv"
        columns={[
          { key: "tier", header: t("draw.prizeColumns.tier"), cell: (p) => <span className="font-medium whitespace-nowrap">{t(`common.tierShort.${p.tier}`)}</span> },
          {
            key: "amount",
            header: t("draw.prizeColumns.amount"),
            numeric: true,
            value: (p) => p.amountPkr,
            cell: (p) => (
              <>
                <bdi>{t("common.rs", { amount: formatNumber(p.amountPkr, locale) })}</bdi>
                {p.inferred ? <span className="ms-1 text-xs text-ink-2">({t("draw.reference")})</span> : null}
              </>
            ),
          },
          { key: "winners", header: t("draw.prizeColumns.winners"), numeric: true, value: (p) => p.winnersCount, cell: (p) => formatNumber(p.winnersCount, locale) },
        ]}
      />
      {anyInferred ? <p className="mt-2 text-xs text-ink-2">{t("common.estimatedNote")}</p> : null}
    </div>
  );
}

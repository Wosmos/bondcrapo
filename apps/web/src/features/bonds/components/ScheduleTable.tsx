import { useLocale, useTranslations } from "next-intl";
import { DataTable } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatDrawDate, formatWeekday } from "../format";
import { denominationSlug } from "../labels";
import type { DrawView } from "../server/pages";
import { StatusBadge } from "./StatusBadge";

export function ScheduleTable({ draws, caption, today }: { draws: DrawView[]; caption: string; today: string }) {
  const t = useTranslations("bonds");
  const locale = useLocale();
  return (
    <DataTable
      caption={caption}
      rows={draws}
      getRowKey={(d) => d.id}
      fileName="bondcheck-schedule.csv"
      columns={[
        {
          key: "date",
          header: t("schedule.columns.date"),
          value: (d) => d.drawDate,
          cell: (d) => (
            <span className={d.drawDate <= today ? "" : "font-medium text-info"}>
              <time dateTime={d.drawDate} className="whitespace-nowrap">{formatDrawDate(d.drawDate, locale)}</time>
              <span className="block text-xs text-ink-2">{formatWeekday(d.drawDate, locale)}</span>
            </span>
          ),
        },
        {
          key: "denomination",
          header: t("schedule.columns.denomination"),
          filter: "select",
          cell: (d) => (
            <Link href={`/prize-bonds/${denominationSlug(d.code)}`} className="underline-offset-4 hover:underline">
              {t(`common.denomination.${d.code}`)}
            </Link>
          ),
        },
        {
          key: "draw",
          header: t("schedule.columns.draw"),
          value: (d) => d.drawNumber ?? null,
          filter: "range",
          cell: (d) =>
            d.drawNumber && d.completeness !== "none" ? (
              <Link href={`/prize-bonds/${denominationSlug(d.code)}/${d.drawNumber}`} className="underline underline-offset-4">
                {t("common.drawNumber", { number: d.drawNumber })}
              </Link>
            ) : d.drawNumber ? (
              t("common.drawNumber", { number: d.drawNumber })
            ) : (
              <span className="text-ink-2">{t("common.drawNumberUnknown")}</span>
            ),
        },
        { key: "city", header: t("schedule.columns.city"), cell: (d) => d.city ?? <span className="text-ink-2">{t("common.cityUnknown")}</span> },
        { key: "status", header: t("schedule.columns.status"), filter: "select", value: (d) => d.status, cell: (d) => <StatusBadge status={d.status} /> },
      ]}
    />
  );
}

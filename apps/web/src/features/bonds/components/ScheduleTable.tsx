import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDrawDate, formatWeekday } from "../format";
import { denominationSlug } from "../labels";
import type { DrawView } from "../server/pages";
import { StatusBadge } from "./StatusBadge";

export function ScheduleTable({ draws, caption, today }: { draws: DrawView[]; caption: string; today: string }) {
  const t = useTranslations("bonds");
  const locale = useLocale();
  return (
    <div tabIndex={0} role="region" aria-label={caption} className="overflow-x-auto rounded-lg border border-line bg-surface focus-visible:outline-2 focus-visible:outline-focus">
      <table className="w-full border-collapse text-sm">
        <caption className="p-3 text-start text-sm font-medium text-ink-2">{caption}</caption>
        <thead>
          <tr className="border-y border-line bg-surface-2">
            {(["date", "denomination", "draw", "city", "status"] as const).map((k) => (
              <th key={k} scope="col" className="px-3 py-2 text-start font-semibold text-ink-2">
                {t(`schedule.columns.${k}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {draws.map((d) => {
            const past = d.drawDate <= today;
            return (
              <tr key={d.id} className={`border-b border-line ${past ? "" : "bg-info/5"}`}>
                <th scope="row" className="px-3 py-2 text-start font-normal whitespace-nowrap">
                  <time dateTime={d.drawDate}>{formatDrawDate(d.drawDate, locale)}</time>
                  <span className="block text-xs text-ink-2">{formatWeekday(d.drawDate, locale)}</span>
                </th>
                <td className="px-3 py-2">
                  <Link href={`/prize-bonds/${denominationSlug(d.code)}`} className="underline-offset-4 hover:underline">
                    {t(`common.denomination.${d.code}`)}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {d.drawNumber && d.completeness !== "none" ? (
                    <Link href={`/prize-bonds/${denominationSlug(d.code)}/${d.drawNumber}`} className="underline underline-offset-4">
                      {t("common.drawNumber", { number: d.drawNumber })}
                    </Link>
                  ) : d.drawNumber ? (
                    t("common.drawNumber", { number: d.drawNumber })
                  ) : (
                    <span className="text-ink-2">{t("common.drawNumberUnknown")}</span>
                  )}
                </td>
                <td className="px-3 py-2">{d.city ?? <span className="text-ink-2">{t("common.cityUnknown")}</span>}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={d.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

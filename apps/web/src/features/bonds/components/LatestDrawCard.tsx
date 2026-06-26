import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDrawDate } from "../format";
import { denominationSlug } from "../labels";
import type { DrawView } from "../server/pages";
import { BondNumber } from "./BondNumber";
import { StatusBadge } from "./StatusBadge";

/** One denomination's latest draw on the hub: the whole card is one link with a clear name. */
export function LatestDrawCard({ draw, firstPrizes }: { draw: DrawView; firstPrizes: number[] }) {
  const t = useTranslations("bonds");
  const locale = useLocale();
  const bond = t(`common.denomination.${draw.code}`);
  const href = draw.drawNumber ? `/prize-bonds/${denominationSlug(draw.code)}/${draw.drawNumber}` : `/prize-bonds/${denominationSlug(draw.code)}`;
  return (
    <li className="relative flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-focus hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {bond}
          </Link>
        </h3>
        <StatusBadge status={draw.status} />
      </div>
      <p className="text-sm text-ink-2">
        {draw.drawNumber ? `${t("common.drawNumber", { number: draw.drawNumber })} · ` : ""}
        <time dateTime={draw.drawDate}>{formatDrawDate(draw.drawDate, locale)}</time>
        {draw.city ? ` · ${draw.city}` : ""}
      </p>
      {firstPrizes.length ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-2">
            {firstPrizes.length > 1 ? t("hub.firstPrizes") : t("hub.firstPrize")}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-ink">
            {firstPrizes.map((n) => (
              <BondNumber key={n} value={n} size="lg" emphasis />
            ))}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-2">{t("hub.noResults")}</p>
      )}
    </li>
  );
}

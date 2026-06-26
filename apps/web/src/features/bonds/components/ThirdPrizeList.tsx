import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "../format";
import { BondNumber } from "./BondNumber";

/**
 * The third prize list in sections by leading digit (000000 to 099999, ...), each with its own
 * heading and a jump link, like the printed lists. No infinite scroll; every number is in the
 * HTML, so find in page works.
 */
export function ThirdPrizeList({ numbers }: { numbers: number[] }) {
  const t = useTranslations("bonds.draw");
  const locale = useLocale();
  const groups = new Map<number, number[]>();
  for (const n of [...numbers].sort((a, b) => a - b)) {
    const g = Math.floor(n / 100_000);
    groups.set(g, [...(groups.get(g) ?? []), n]);
  }
  const ranges = [...groups.keys()].sort((a, b) => a - b);
  const label = (g: number) => t("rangeHeading", { from: `${g}00000`, to: `${g}99999` });
  return (
    <section aria-labelledby="third-prize">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="third-prize" className="text-lg font-semibold text-ink">
          {t("thirdPrizeTitle")}
        </h2>
        <p className="text-sm text-ink-2">{t("thirdCount", { count: numbers.length })}</p>
      </div>
      <nav aria-label={t("jumpToRange")} className="mt-3">
        <p className="mb-1 text-sm text-ink-2">{t("jumpToRange")}</p>
        <ul className="flex flex-wrap gap-2">
          {ranges.map((g) => (
            <li key={g}>
              <a
                href={`#range-${g}`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line-strong bg-surface px-3 font-mono text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <bdi dir="ltr">{g}…</bdi>
                <span className="sr-only"> ({label(g)})</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {ranges.map((g) => (
        <section key={g} id={`range-${g}`} aria-labelledby={`range-${g}-h`} className="mt-5 scroll-mt-24">
          <h3 id={`range-${g}-h`} className="mb-2 text-sm font-semibold text-ink-2">
            <bdi dir="ltr">{label(g)}</bdi>{" "}
            <span className="font-normal text-ink-2">({formatNumber(groups.get(g)!.length, locale)})</span>
          </h3>
          <ul dir="ltr" className="grid grid-cols-3 gap-x-2 gap-y-1 text-ink min-[420px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
            {groups.get(g)!.map((n) => (
              <li key={n} className="rounded px-1 py-0.5 text-center odd:bg-surface-2">
                <BondNumber value={n} size="sm" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

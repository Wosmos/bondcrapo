import { useTranslations } from "next-intl";
import { BondNumber } from "./BondNumber";

/** First and second prize numbers, large and easy to compare against a printed bond. */
export function TopPrizes({ tier1, tier2 }: { tier1: number[]; tier2: number[] }) {
  const t = useTranslations("bonds.draw");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section aria-labelledby="first-prize" className="rounded-lg border-2 border-slate-900 bg-white p-4">
        <h2 id="first-prize" className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          {t("firstPrizeTitle")}
        </h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-900">
          {tier1.map((n) => (
            <li key={n}>
              <BondNumber value={n} size="xl" emphasis />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="second-prize" className="rounded-lg border border-slate-300 bg-white p-4">
        <h2 id="second-prize" className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          {t("secondPrizeTitle")}
        </h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-900">
          {tier2.map((n) => (
            <li key={n}>
              <BondNumber value={n} size="lg" emphasis />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

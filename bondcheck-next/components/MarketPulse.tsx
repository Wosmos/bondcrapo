"use client";

import useSWR from "swr";
import type { MarketPulse as MarketPulseData } from "@/types";
import type { Locale } from "@/lib/i18n";
import { formatNumber, formatDecimal } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MarketPulseProps {
  locale?: Locale;
  t?: (key: string) => string;
}

const DENOM_LABELS: Record<number, string> = {
  100: "Rs. 100", 200: "Rs. 200", 500: "Rs. 500", 750: "Rs. 750",
  1000: "Rs. 1,000", 1500: "Rs. 1,500", 5000: "Rs. 5,000",
  10000: "Rs. 10,000", 25000: "Rs. 25,000", 40000: "Rs. 40,000",
};

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-[150px] snap-start flex-shrink-0">
      <div className="loading-skeleton h-3 w-16 mb-3 rounded" />
      <div className="loading-skeleton h-7 w-24 mb-2 rounded" />
      <div className="loading-skeleton h-3 w-12 rounded" />
    </div>
  );
}

export function MarketPulse({ locale = "en", t }: MarketPulseProps) {
  const { data, isLoading } = useSWR<MarketPulseData>(
    "/api/market-pulse",
    fetcher,
    { revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 60_000 }
  );

  const tr = t ?? ((k: string) => k);
  const loc = locale;

  const nextDraw = data?.next_draw;
  const daysUntil = nextDraw?.days_until;

  function timeAgo(iso: string | null | undefined): string {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return tr("just_now");
    if (mins < 60) return `${formatNumber(mins, loc)} ${tr("min_ago")}`;
    const hrs = Math.floor(mins / 60);
    return `${formatNumber(hrs, loc)} ${tr("hr_ago")}`;
  }

  function formatDrawDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(loc === "ur" ? "ur-PK" : loc === "pa" ? "pa-Arab-PK" : "en-GB", {
      day: "numeric", month: "short",
    });
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {tr("market_pulse")}
          </h2>
        </div>
        {data?.updated_at && (
          <span className="text-[10px] text-gray-400">
            {tr("updated")} {timeAgo(data.updated_at)}
          </span>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-thin pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {isLoading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            {/* Gold */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-[150px] snap-start flex-shrink-0">
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2">
                {tr("gold_24k")}
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {formatNumber(data?.gold?.price_24k_tola, loc)}
              </p>
              <p className="text-[10px] text-gray-400">{tr("per_tola")}</p>
            </div>

            {/* Silver */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-[150px] snap-start flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {tr("silver")}
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {formatNumber(data?.silver?.price_tola, loc)}
              </p>
              <p className="text-[10px] text-gray-400">{tr("per_tola")}</p>
            </div>

            {/* USD/PKR */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-[150px] snap-start flex-shrink-0">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-2">
                {tr("usd_pkr")}
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {formatDecimal(data?.usd_pkr?.rate, loc)}
              </p>
              <p className="text-[10px] text-gray-400">
                {tr("interbank")}
              </p>
            </div>

            {/* KSE-100 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-[150px] snap-start flex-shrink-0">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                {tr("kse_100")}
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {data?.kse100?.value != null
                  ? formatNumber(data.kse100.value, loc)
                  : "\u2014"}
              </p>
              <p className="text-[10px] text-gray-400">
                {data?.kse100?.change_percent != null
                  ? `${data.kse100.change_percent >= 0 ? "+" : ""}${formatDecimal(data.kse100.change_percent, loc)}%`
                  : tr("index")}
              </p>
            </div>

            {/* Next Draw */}
            <div className={`bg-white border rounded-lg p-4 min-w-[150px] snap-start flex-shrink-0 ${
              daysUntil != null && daysUntil <= 3 ? "border-amber-300 bg-amber-50/50" : "border-gray-200"
            }`}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {nextDraw
                  ? DENOM_LABELS[nextDraw.denomination] ?? `Rs. ${formatNumber(nextDraw.denomination, loc)}`
                  : tr("next_draw")}
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {daysUntil != null ? (
                  daysUntil <= 0 ? (
                    <span className="text-amber-600">{tr("today")}</span>
                  ) : (
                    <>
                      {formatNumber(daysUntil, loc)}
                      <span className="text-xs text-gray-400 ml-1.5 font-sans font-normal">
                        {tr(daysUntil === 1 ? "day" : "days")}
                      </span>
                    </>
                  )
                ) : (
                  "\u2014"
                )}
              </p>
              <p className="text-[10px] text-gray-400">
                {nextDraw
                  ? `${formatDrawDate(nextDraw.draw_date)}${nextDraw.city ? ` \u00b7 ${nextDraw.city}` : ""}`
                  : tr("no_upcoming_draw")}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

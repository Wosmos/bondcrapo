"use client";

import useSWR from "swr";
import type { MarketPulse as MarketPulseData } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DENOM_LABELS: Record<number, string> = {
  100: "Rs. 100",
  200: "Rs. 200",
  500: "Rs. 500",
  750: "Rs. 750",
  1000: "Rs. 1,000",
  1500: "Rs. 1,500",
  5000: "Rs. 5,000",
  10000: "Rs. 10,000",
  25000: "Rs. 25,000",
  40000: "Rs. 40,000",
};

function formatPrice(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return value.toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function formatRate(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return "1 hr ago";
  return `${hrs} hrs ago`;
}

function formatDrawDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-sm p-4 min-w-[140px] snap-start flex-shrink-0">
      <div className="loading-skeleton h-3 w-16 mb-3 rounded" />
      <div className="loading-skeleton h-7 w-20 mb-2 rounded" />
      <div className="loading-skeleton h-3 w-12 rounded" />
    </div>
  );
}

export function MarketPulse() {
  const { data, isLoading } = useSWR<MarketPulseData>(
    "/api/market-pulse",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60_000,
    }
  );

  const nextDraw = data?.next_draw;
  const daysUntil = nextDraw?.days_until;

  return (
    <div className="mb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Market Pulse
          </h2>
        </div>
        {data?.updated_at && (
          <span className="text-[10px] text-gray-400">
            Updated {timeAgo(data.updated_at)}
          </span>
        )}
      </div>

      {/* Cards — horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-thin pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* Card 1: GOLD */}
            <div className="bg-white border border-gray-200 rounded-sm p-4 min-w-[140px] snap-start flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Gold 24K
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {formatPrice(data?.gold?.price_24k_tola)}
              </p>
              <p className="text-[10px] text-gray-400">per tola</p>
            </div>

            {/* Card 2: SILVER */}
            <div className="bg-white border border-gray-200 rounded-sm p-4 min-w-[140px] snap-start flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Silver
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {formatPrice(data?.silver?.price_tola)}
              </p>
              <p className="text-[10px] text-gray-400">per tola</p>
            </div>

            {/* Card 3: USD/PKR */}
            <div className="bg-white border border-gray-200 rounded-sm p-4 min-w-[140px] snap-start flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                USD / PKR
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {formatRate(data?.usd_pkr?.rate)}
              </p>
              <p className="text-[10px] text-gray-400">
                {data?.usd_pkr?.rate_type ?? "interbank"}
              </p>
            </div>

            {/* Card 4: KSE-100 (placeholder until commodity API) */}
            <div className="bg-white border border-gray-200 rounded-sm p-4 min-w-[140px] snap-start flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                KSE-100
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {data?.kse100?.value != null
                  ? data.kse100.value.toLocaleString("en-PK", { maximumFractionDigits: 0 })
                  : "\u2014"}
              </p>
              <p className="text-[10px] text-gray-400">
                {data?.kse100?.change_percent != null
                  ? `${data.kse100.change_percent >= 0 ? "+" : ""}${data.kse100.change_percent.toFixed(2)}%`
                  : "index"}
              </p>
            </div>

            {/* Card 5: NEXT DRAW */}
            <div className="bg-white border border-gray-200 rounded-sm p-4 min-w-[140px] snap-start flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {nextDraw
                  ? DENOM_LABELS[nextDraw.denomination] ?? `Rs. ${nextDraw.denomination.toLocaleString()}`
                  : "Next Draw"}
              </p>
              <p className="text-2xl font-mono font-bold tracking-tight mb-1">
                {daysUntil != null ? (
                  <>
                    {daysUntil <= 0 ? "Today" : daysUntil}
                    {daysUntil > 0 && (
                      <span className="text-xs text-gray-400 ml-1.5 font-sans font-normal">
                        {daysUntil === 1 ? "day" : "days"}
                      </span>
                    )}
                  </>
                ) : (
                  "\u2014"
                )}
              </p>
              <p className="text-[10px] text-gray-400">
                {nextDraw
                  ? `${formatDrawDate(nextDraw.draw_date)}${nextDraw.city ? ` \u00b7 ${nextDraw.city}` : ""}`
                  : "no upcoming draw"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import useSWR from "swr";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import type { StatsResponse } from "@/types";
import type { Locale } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface StatsDashboardProps {
  refreshKey: number;
  locale?: Locale;
  t?: (key: string) => string;
}

export function StatsDashboard({ refreshKey, locale = "en", t }: StatsDashboardProps) {
  const { data } = useSWR<StatsResponse>(
    `/api/stats?_=${refreshKey}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 300000,
    }
  );

  const tr = t ?? ((k: string) => {
    const fallback: Record<string, string> = {
      draws_covered: "Draws Covered", prize_records: "Prize Records",
      total_prizes: "Total Prizes", all_denominations: "All denominations",
      winning_bonds: "Winning bonds on file", pkr_paid: "PKR paid out",
    };
    return fallback[k] ?? k;
  });

  const totalWinners = data?.total_winners ?? 0;
  const draws = Math.floor(totalWinners / 1000);
  const totalAmount =
    data?.by_position?.reduce((acc, curr) => acc + curr.total_amount, 0) ?? 0;

  return (
    <div className="grid grid-cols-3 border border-gray-200 divide-x divide-gray-200 rounded-sm mb-10 bg-white">
      <div className="p-3 md:p-6 flex flex-col justify-center">
        <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-tight md:tracking-wider mb-1">
          {tr("draws_covered")}
        </p>
        <h3 className="text-lg md:text-3xl font-mono font-semibold">
          <AnimatedCounter value={draws} locale={locale} />
        </h3>
        <span className="text-[9px] md:text-xs text-gray-400 mt-1 block leading-tight">
          {tr("all_denominations")}
        </span>
      </div>

      <div className="p-3 md:p-6 flex flex-col justify-center">
        <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-tight md:tracking-wider mb-1">
          {tr("prize_records")}
        </p>
        <h3 className="text-lg md:text-3xl font-mono font-semibold text-emerald-600">
          <AnimatedCounter value={totalWinners} locale={locale} />
        </h3>
        <span className="text-[9px] md:text-xs text-gray-400 mt-1 block leading-tight">
          {tr("winning_bonds")}
        </span>
      </div>

      <div className="p-3 md:p-6 flex flex-col justify-center">
        <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-tight md:tracking-wider mb-1">
          {tr("total_prizes")}
        </p>
        <h3 className="text-lg md:text-3xl font-mono font-semibold tracking-tighter md:tracking-tight">
          <AnimatedCounter value={totalAmount} format="compact" locale={locale} />
        </h3>
        <span className="text-[9px] md:text-xs text-gray-400 mt-1 block leading-tight">
          {tr("pkr_paid")}
        </span>
      </div>
    </div>
  );
}

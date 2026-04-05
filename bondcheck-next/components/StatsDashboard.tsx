"use client";

import useSWR from "swr";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import type { StatsResponse } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function StatsDashboard({ refreshKey }: { refreshKey: number }) {
  const { data } = useSWR<StatsResponse>(
    `/api/stats?_=${refreshKey}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 300000, // 5 minutes
    }
  );

  const totalWinners = data?.total_winners ?? 0;
  const draws = Math.floor(totalWinners / 1000);
  const totalAmount =
    data?.by_position?.reduce((acc, curr) => acc + curr.total_amount, 0) ?? 0;

  return (
    <div className="grid grid-cols-3 border border-gray-200 divide-x divide-gray-200 rounded-sm mb-10 bg-white">
      <div className="p-3 md:p-6 flex flex-col justify-center">
        <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-tight md:tracking-wider mb-1">
          Draws Covered
        </p>
        <h3 className="text-lg md:text-3xl font-mono font-semibold">
          <AnimatedCounter value={draws} />
        </h3>
        <span className="text-[9px] md:text-xs text-gray-400 mt-1 block leading-tight">
          All denominations
        </span>
      </div>

      <div className="p-3 md:p-6 flex flex-col justify-center">
        <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-tight md:tracking-wider mb-1">
          Prize Records
        </p>
        <h3 className="text-lg md:text-3xl font-mono font-semibold text-emerald-600">
          <AnimatedCounter value={totalWinners} />
        </h3>
        <span className="text-[9px] md:text-xs text-gray-400 mt-1 block leading-tight">
          Winning bonds on file
        </span>
      </div>

      <div className="p-3 md:p-6 flex flex-col justify-center">
        <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-tight md:tracking-wider mb-1">
          Total Prizes
        </p>
        <h3 className="text-lg md:text-3xl font-mono font-semibold tracking-tighter md:tracking-tight">
          <AnimatedCounter value={totalAmount} format="compact" />
        </h3>
        <span className="text-[9px] md:text-xs text-gray-400 mt-1 block leading-tight">
          PKR paid out
        </span>
      </div>
    </div>
  );
}

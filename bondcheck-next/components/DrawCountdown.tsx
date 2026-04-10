"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { DrawScheduleEntry } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ScheduleResponse {
  next_draws: DrawScheduleEntry[];
}

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

function formatCountdown(daysUntil: number): { value: string; label: string; urgent: boolean } {
  if (daysUntil <= 0) return { value: "Today", label: "Draw day!", urgent: true };
  if (daysUntil === 1) return { value: "1", label: "day left", urgent: true };
  if (daysUntil <= 7) return { value: String(daysUntil), label: "days left", urgent: true };
  if (daysUntil <= 30) return { value: String(daysUntil), label: "days", urgent: false };
  const weeks = Math.floor(daysUntil / 7);
  return { value: String(weeks), label: weeks === 1 ? "week" : "weeks", urgent: false };
}

function formatDrawDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function DrawCountdown() {
  const { data } = useSWR<ScheduleResponse>(
    "/api/draw-schedule?mode=next",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 600_000, // 10 minutes
    }
  );

  const draws = data?.next_draws ?? [];

  if (draws.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Upcoming Draws
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {draws.map((draw) => {
          const countdown = formatCountdown(draw.days_until ?? 99);
          return (
            <DrawCard key={`${draw.denomination}-${draw.draw_date}`} draw={draw} countdown={countdown} />
          );
        })}
      </div>
    </div>
  );
}

function DrawCard({
  draw,
  countdown,
}: {
  draw: DrawScheduleEntry;
  countdown: { value: string; label: string; urgent: boolean };
}) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (countdown.urgent) {
      const id = setInterval(() => setPulse((p) => !p), 2000);
      return () => clearInterval(id);
    }
  }, [countdown.urgent]);

  return (
    <div
      className={`
        bg-white border rounded-sm p-4 flex flex-col justify-between
        transition-colors
        ${countdown.urgent
          ? "border-[#0f172a] ring-1 ring-[#0f172a]/5"
          : "border-gray-200 hover:border-gray-300"
        }
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {DENOM_LABELS[draw.denomination] ?? `Rs. ${draw.denomination.toLocaleString()}`}
        </span>
        {countdown.urgent && (
          <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${pulse ? "opacity-100" : "opacity-30"} transition-opacity`} />
        )}
      </div>

      <div className="mb-2">
        <span className="text-2xl font-mono font-bold tracking-tight">
          {countdown.value}
        </span>
        {countdown.label && (
          <span className="text-xs text-gray-400 ml-1.5">
            {countdown.label}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] text-gray-400">
          {formatDrawDate(draw.draw_date)}
        </p>
        {draw.city && (
          <p className="text-[10px] text-gray-400">
            {draw.city}
          </p>
        )}
        {draw.draw_number && (
          <p className="text-[10px] text-gray-300 font-mono">
            #{draw.draw_number}
          </p>
        )}
      </div>
    </div>
  );
}

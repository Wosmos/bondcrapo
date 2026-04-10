"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DenomAnalysis {
  denomination: number;
  total_prizes_per_draw: number;
  total_winners_per_draw: number;
  win_probability_per_draw: number;
  win_probability_per_year: number;
  expected_value_per_year: number;
  expected_value_after_tax: number;
  effective_annual_return_percent: number;
  filer_status: string;
  prize_structure: {
    first: { amount: number; count: number };
    second: { amount: number; count: number };
    third: { amount: number; count: number };
  };
}

function formatPKR(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)} Lakh`;
  return n.toLocaleString();
}

export function WinProbability() {
  const [filerStatus, setFilerStatus] = useState<"filer" | "non_filer">("filer");

  const { data } = useSWR<{ denominations: DenomAnalysis[] }>(
    `/api/tax?mode=compare&filer_status=${filerStatus}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 600_000,
    }
  );

  const denoms = data?.denominations ?? [];

  // Sort: physical bonds first (100-1500), then digital (500-10000), then premium (25000-40000)
  const sorted = [...denoms].sort((a, b) => a.denomination - b.denomination);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Win Probability & Expected Value
          </h2>
        </div>
        <div className="flex items-center bg-white border border-gray-200 rounded-sm overflow-hidden">
          <button
            onClick={() => setFilerStatus("filer")}
            className={`px-3 py-1.5 text-[10px] font-medium transition-colors ${
              filerStatus === "filer"
                ? "bg-[#0f172a] text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Filer
          </button>
          <button
            onClick={() => setFilerStatus("non_filer")}
            className={`px-3 py-1.5 text-[10px] font-medium transition-colors ${
              filerStatus === "non_filer"
                ? "bg-[#0f172a] text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Non-Filer
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Denomination</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">1st Prize</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">2nd Prize</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">3rd Prize</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Win Prob/Draw</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Win Prob/Year</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">EV/Year (Net)</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Eff. Return</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((d) => (
              <tr key={d.denomination} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold">
                  Rs. {d.denomination.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">
                  {formatPKR(d.prize_structure.first.amount)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">
                  {formatPKR(d.prize_structure.second.amount)}
                  <span className="text-gray-300 ml-1">x{d.prize_structure.second.count}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">
                  {formatPKR(d.prize_structure.third.amount)}
                  <span className="text-gray-300 ml-1">x{d.prize_structure.third.count}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {(d.win_probability_per_draw * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {(d.win_probability_per_year * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600 font-semibold">
                  Rs. {d.expected_value_after_tax.toFixed(0)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  <span className={d.effective_annual_return_percent > 0 ? "text-emerald-600" : "text-gray-400"}>
                    {d.effective_annual_return_percent.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-400 mt-2">
        Expected value assumes 1M bonds per series. Win probability is per single bond.
        Tax: {filerStatus === "filer" ? "15%" : "30%"} withholding on prize money.
      </p>
    </div>
  );
}

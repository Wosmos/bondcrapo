"use client";

import { useState, useMemo } from "react";

const TAX_RATES = {
  prize_filer: 0.15,
  prize_non_filer: 0.30,
  savings_filer: 0.15,
  savings_non_filer: 0.35,
} as const;

type CalcMode = "prize" | "savings";

export function TaxCalculator() {
  const [mode, setMode] = useState<CalcMode>("prize");
  const [filerStatus, setFilerStatus] = useState<"filer" | "non_filer">("filer");
  const [amount, setAmount] = useState("");
  // Savings-specific
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("11.08");
  const [years, setYears] = useState("10");

  const prizeResult = useMemo(() => {
    const n = Number(amount);
    if (!n || n <= 0) return null;
    const taxRate = filerStatus === "filer" ? TAX_RATES.prize_filer : TAX_RATES.prize_non_filer;
    const tax = Math.round(n * taxRate);
    return { gross: n, tax_rate: taxRate, tax, net: n - tax };
  }, [amount, filerStatus]);

  const savingsResult = useMemo(() => {
    const p = Number(principal);
    const r = Number(rate);
    const y = Number(years);
    if (!p || !r || !y) return null;

    const grossValue = p * Math.pow(1 + r / 100, y);
    const grossProfit = grossValue - p;
    const taxRate = filerStatus === "filer" ? TAX_RATES.savings_filer : TAX_RATES.savings_non_filer;
    const tax = grossProfit * taxRate;
    return {
      principal: p,
      gross_value: Math.round(grossValue),
      gross_profit: Math.round(grossProfit),
      tax_rate: taxRate,
      tax: Math.round(tax),
      net_profit: Math.round(grossProfit - tax),
      net_value: Math.round(p + grossProfit - tax),
    };
  }, [principal, rate, years, filerStatus]);

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="18" rx="2" />
          <path d="M8 7v10M12 7v10M16 7v10" />
        </svg>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Tax Calculator
        </h2>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm">
        {/* Mode + Filer Toggle */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center bg-gray-100 rounded-sm overflow-hidden">
            <button
              onClick={() => setMode("prize")}
              className={`px-3 py-1.5 text-[10px] font-medium transition-colors ${
                mode === "prize" ? "bg-[#0f172a] text-white" : "text-gray-500"
              }`}
            >
              Prize Bond Tax
            </button>
            <button
              onClick={() => setMode("savings")}
              className={`px-3 py-1.5 text-[10px] font-medium transition-colors ${
                mode === "savings" ? "bg-[#0f172a] text-white" : "text-gray-500"
              }`}
            >
              Savings Maturity
            </button>
          </div>
          <div className="flex items-center bg-gray-100 rounded-sm overflow-hidden">
            <button
              onClick={() => setFilerStatus("filer")}
              className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                filerStatus === "filer" ? "bg-emerald-600 text-white" : "text-gray-500"
              }`}
            >
              Filer
            </button>
            <button
              onClick={() => setFilerStatus("non_filer")}
              className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                filerStatus === "non_filer" ? "bg-amber-600 text-white" : "text-gray-500"
              }`}
            >
              Non-Filer
            </button>
          </div>
        </div>

        <div className="p-4">
          {mode === "prize" ? (
            <>
              {/* Prize Bond Tax */}
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                Prize Amount (Rs.)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 3000000"
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#0f172a] mb-4"
              />

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[700_000, 1_500_000, 3_000_000, 30_000_000, 80_000_000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="px-2 py-1 text-[10px] font-mono border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors"
                  >
                    {v >= 10_000_000 ? `${v / 10_000_000} Cr` : v >= 100_000 ? `${v / 100_000} Lakh` : v.toLocaleString()}
                  </button>
                ))}
              </div>

              {prizeResult && (
                <div className="border border-gray-200 rounded-sm divide-y divide-gray-100">
                  <div className="flex justify-between px-4 py-2.5 text-xs">
                    <span className="text-gray-500">Gross Prize</span>
                    <span className="font-mono">Rs. {prizeResult.gross.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-xs">
                    <span className="text-gray-500">Tax ({(prizeResult.tax_rate * 100).toFixed(0)}%)</span>
                    <span className="font-mono text-red-500">- Rs. {prizeResult.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-sm bg-gray-50">
                    <span className="font-semibold">You Receive</span>
                    <span className="font-mono font-bold text-emerald-600">Rs. {prizeResult.net.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {prizeResult && filerStatus === "non_filer" && (
                <p className="text-[10px] text-amber-600 mt-2">
                  As a filer you&apos;d save Rs. {(prizeResult.tax - Math.round(prizeResult.gross * 0.15)).toLocaleString()} on this prize.
                </p>
              )}
            </>
          ) : (
            <>
              {/* Savings Maturity Calculator */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Principal (Rs.)
                  </label>
                  <input
                    type="number"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    placeholder="100000"
                    className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Years
                  </label>
                  <input
                    type="number"
                    value={years}
                    onChange={(e) => setYears(e.target.value)}
                    className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
                  />
                </div>
              </div>

              {/* Quick rate presets */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[
                  ["Bahbood 12.48%", "12.48"],
                  ["Defence 11.08%", "11.08"],
                  ["Special 11%", "11.00"],
                  ["RIC 10.56%", "10.56"],
                  ["STSC 10.68%", "10.68"],
                ].map(([label, val]) => (
                  <button
                    key={val}
                    onClick={() => setRate(val)}
                    className={`px-2 py-1 text-[10px] border rounded-sm transition-colors ${
                      rate === val
                        ? "bg-[#0f172a] text-white border-[#0f172a]"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {savingsResult && (
                <div className="border border-gray-200 rounded-sm divide-y divide-gray-100">
                  <div className="flex justify-between px-4 py-2.5 text-xs">
                    <span className="text-gray-500">Principal</span>
                    <span className="font-mono">Rs. {savingsResult.principal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-xs">
                    <span className="text-gray-500">Gross Profit ({Number(rate)}% x {years}y)</span>
                    <span className="font-mono text-emerald-600">+ Rs. {savingsResult.gross_profit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-xs">
                    <span className="text-gray-500">Tax ({(savingsResult.tax_rate * 100).toFixed(0)}% WHT)</span>
                    <span className="font-mono text-red-500">- Rs. {savingsResult.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-sm bg-gray-50">
                    <span className="font-semibold">Maturity Value</span>
                    <span className="font-mono font-bold text-emerald-600">Rs. {savingsResult.net_value.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

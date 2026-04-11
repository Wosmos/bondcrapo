"use client";

import { useState } from "react";
import {
  scrapeTarget,
  getScrapeTargets,
  scrapeAllHistorical,
  scrapePkPrizeBondDenom,
  getPkPrizeBondScrapeTargets,
} from "@/actions/scraper";
import type { ScrapeResult } from "@/lib/scraper-logic";

export function ScraperActions() {
  const [running, setRunning] = useState(false);
  const [runningHistorical, setRunningHistorical] = useState(false);
  const [runningPkPrizeBond, setRunningPkPrizeBond] = useState(false);
  const [currentTarget, setCurrentTarget] = useState("");
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const anyRunning = running || runningHistorical || runningPkPrizeBond;

  const startHistoricalScrape = async () => {
    setRunningHistorical(true);
    setResults([]);
    setCurrentTarget("Historical records (prizeinfo.net) - all denominations");
    try {
      const result = await scrapeAllHistorical();
      setResults([result]);
    } catch (err) {
      setResults([
        {
          source: "prizeinfo_net",
          denomination: 0,
          jobsFound: 0,
          inserted: 0,
          skipped: 0,
          errors: [String(err)],
        },
      ]);
    }
    setCurrentTarget("");
    setRunningHistorical(false);
  };

  const startPkPrizeBondScrape = async () => {
    setRunningPkPrizeBond(true);
    setResults([]);

    const targets = await getPkPrizeBondScrapeTargets();
    setProgress({ done: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setCurrentTarget(`pkprizebond.com / Rs. ${t.denomination}`);
      try {
        const result = await scrapePkPrizeBondDenom(t.denomination);
        if (result.inserted > 0 || result.errors.length > 0) {
          setResults((prev) => [...prev, result]);
        }
      } catch (err) {
        setResults((prev) => [
          ...prev,
          {
            source: "pkprizebond_com",
            denomination: t.denomination,
            jobsFound: 0,
            inserted: 0,
            skipped: 0,
            errors: [String(err)],
          },
        ]);
      }
      setProgress({ done: i + 1, total: targets.length });
    }

    setCurrentTarget("");
    setRunningPkPrizeBond(false);
  };

  const startScrape = async () => {
    setRunning(true);
    setResults([]);

    const targets = await getScrapeTargets();
    setProgress({ done: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setCurrentTarget(`${t.source} / Rs. ${t.denomination}`);
      try {
        const result = await scrapeTarget(t.source, t.denomination);
        if (result.inserted > 0 || result.errors.length > 0) {
          setResults((prev) => [...prev, result]);
        }
      } catch (err) {
        setResults((prev) => [
          ...prev,
          {
            source: t.source,
            denomination: t.denomination,
            jobsFound: 0,
            inserted: 0,
            skipped: 0,
            errors: [String(err)],
          },
        ]);
      }
      setProgress({ done: i + 1, total: targets.length });
    }

    setCurrentTarget("");
    setRunning(false);
  };

  const totalInserted = results.reduce((acc, r) => acc + r.inserted, 0);
  const totalErrors = results.reduce((acc, r) => acc + r.errors.length, 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
        Manual Scrape Actions
      </h2>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={startScrape}
          disabled={anyRunning}
          className="h-10 px-6 bg-[#0f172a] text-white font-bold text-xs uppercase tracking-widest rounded-md disabled:opacity-50 hover:bg-[#1e293b] transition-colors"
        >
          {running ? "Scraping..." : "Full Scrape"}
        </button>
        <button
          onClick={startHistoricalScrape}
          disabled={anyRunning}
          className="h-10 px-6 bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest rounded-md disabled:opacity-50 hover:bg-emerald-700 transition-colors"
        >
          {runningHistorical ? "Scraping..." : "Historical (2000+)"}
        </button>
        <button
          onClick={startPkPrizeBondScrape}
          disabled={anyRunning}
          className="h-10 px-6 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-md disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {runningPkPrizeBond ? "Scraping..." : "PkPrizeBond (2002+)"}
        </button>
      </div>

      {(running || runningPkPrizeBond) && (
        <div className="mt-5">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span className="truncate mr-4">{currentTarget}</span>
            <span className="font-mono shrink-0">
              {progress.done}/{progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-5">
          <div className="flex gap-6 mb-3 text-sm">
            <span className="text-emerald-600 font-bold">
              {totalInserted.toLocaleString()} inserted
            </span>
            {totalErrors > 0 && (
              <span className="text-red-500 font-bold">{totalErrors} errors</span>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-bold text-[10px] uppercase text-gray-400 tracking-wider">
                    Source
                  </th>
                  <th className="text-left px-4 py-2.5 font-bold text-[10px] uppercase text-gray-400 tracking-wider">
                    Denom
                  </th>
                  <th className="text-right px-4 py-2.5 font-bold text-[10px] uppercase text-gray-400 tracking-wider">
                    Found
                  </th>
                  <th className="text-right px-4 py-2.5 font-bold text-[10px] uppercase text-gray-400 tracking-wider">
                    Inserted
                  </th>
                  <th className="text-right px-4 py-2.5 font-bold text-[10px] uppercase text-gray-400 tracking-wider">
                    Skipped
                  </th>
                  <th className="text-left px-4 py-2.5 font-bold text-[10px] uppercase text-gray-400 tracking-wider">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-mono text-xs">{r.source}</td>
                    <td className="px-4 py-2">Rs. {r.denomination.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.jobsFound}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 font-bold font-mono">
                      {r.inserted}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-400 font-mono">
                      {r.skipped}
                    </td>
                    <td className="px-4 py-2 text-red-500 text-xs truncate max-w-[200px]">
                      {r.errors.join(", ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { scrapeTarget, getScrapeTargets, scrapeAllHistorical, scrapePkPrizeBondDenom, getPkPrizeBondScrapeTargets } from "@/actions/scraper";
import type { ScrapeResult } from "@/lib/scraper-logic";

const IS_DEV = process.env.NODE_ENV !== "production";

function AdminContent() {
  const [running, setRunning] = useState(false);
  const [runningHistorical, setRunningHistorical] = useState(false);
  const [runningPkPrizeBond, setRunningPkPrizeBond] = useState(false);
  const [currentTarget, setCurrentTarget] = useState("");
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const startHistoricalScrape = async () => {
    setRunningHistorical(true);
    setResults([]);
    setCurrentTarget("Historical records (prizeinfo.net) — all denominations");
    try {
      const result = await scrapeAllHistorical();
      setResults([result]);
    } catch (err) {
      setResults([{
        source: "prizeinfo_net",
        denomination: 0,
        jobsFound: 0,
        inserted: 0,
        skipped: 0,
        errors: [String(err)],
      }]);
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
    <div className="max-w-3xl mx-auto mt-40">
      <h1 className="text-2xl font-bold mb-2">Scraper Admin</h1>
      <p className="text-sm text-gray-500 mb-8">
        Scrape prize bond data from prizeinfo.net and pkprizebond.com.
        &quot;Full Scrape&quot; fetches recent draws. &quot;Historical&quot; fetches 1st/2nd prize
        records back to 2000 with draw numbers and cities.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={startScrape}
          disabled={running || runningHistorical || runningPkPrizeBond}
          className="h-12 px-8 bg-[#0f172a] text-white font-bold text-sm uppercase tracking-widest rounded-md disabled:opacity-50 btn-hover"
        >
          {running ? "Scraping..." : "Full Scrape"}
        </button>
        <button
          onClick={startHistoricalScrape}
          disabled={running || runningHistorical || runningPkPrizeBond}
          className="h-12 px-8 bg-emerald-600 text-white font-bold text-sm uppercase tracking-widest rounded-md disabled:opacity-50 hover:bg-emerald-700 transition-colors"
        >
          {runningHistorical ? "Scraping..." : "Historical (2000+)"}
        </button>
        <button
          onClick={startPkPrizeBondScrape}
          disabled={running || runningHistorical || runningPkPrizeBond}
          className="h-12 px-8 bg-blue-600 text-white font-bold text-sm uppercase tracking-widest rounded-md disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {runningPkPrizeBond ? "Scraping..." : "PkPrizeBond (2002+)"}
        </button>
      </div>

      {(running || runningPkPrizeBond) && (
        <div className="mt-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>{currentTarget}</span>
            <span>
              {progress.done}/{progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{
                width: `${(progress.done / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-8">
          <div className="flex gap-6 mb-4 text-sm">
            <span className="text-emerald-600 font-bold">
              {totalInserted.toLocaleString()} inserted
            </span>
            {totalErrors > 0 && (
              <span className="text-red-500 font-bold">
                {totalErrors} errors
              </span>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase text-gray-500">
                    Source
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase text-gray-500">
                    Denom
                  </th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase text-gray-500">
                    Found
                  </th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase text-gray-500">
                    Inserted
                  </th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase text-gray-500">
                    Skipped
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase text-gray-500">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-mono text-xs">{r.source}</td>
                    <td className="px-4 py-2">Rs. {r.denomination}</td>
                    <td className="px-4 py-2 text-right">{r.jobsFound}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 font-bold">
                      {r.inserted}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-400">
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

export default function AdminPage() {
  if (!IS_DEV) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-300 mb-2">404</h1>
        <p className="text-sm text-gray-400">This page could not be found.</p>
      </div>
    );
  }

  return <AdminContent />;
}

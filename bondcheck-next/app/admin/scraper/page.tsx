import { db } from "@/lib/db";
import { winners, goldPrices, newsArticles } from "@/lib/schema";
import { count, max, sql, eq } from "drizzle-orm";
import { ScraperActions } from "./ScraperActions";

async function getScraperStats() {
  const [
    lastScrapeTime,
    recordsBySource,
    recordsByDenom,
    goldLatest,
    goldLastFetch,
    newsCount,
    newsLastFetch,
  ] = await Promise.all([
    // Last scrape time
    db.select({ value: max(winners.createdAt) }).from(winners),

    // Records per source
    db
      .select({
        source: winners.source,
        total: count(),
      })
      .from(winners)
      .groupBy(winners.source)
      .orderBy(sql`COUNT(*) DESC`),

    // Records per denomination
    db
      .select({
        denomination: winners.denomination,
        total: count(),
      })
      .from(winners)
      .groupBy(winners.denomination)
      .orderBy(winners.denomination),

    // Gold latest prices
    db
      .select({
        karat: goldPrices.karat,
        unit: goldPrices.unit,
        pricePkr: goldPrices.pricePkr,
        recordedAt: goldPrices.recordedAt,
      })
      .from(goldPrices)
      .orderBy(sql`${goldPrices.recordedAt} DESC`)
      .limit(6),

    // Gold last fetch time
    db.select({ value: max(goldPrices.recordedAt) }).from(goldPrices),

    // News articles count
    db.select({ value: count() }).from(newsArticles),

    // News last fetch time
    db.select({ value: max(newsArticles.fetchedAt) }).from(newsArticles),
  ]);

  return {
    lastScrapeTime: lastScrapeTime[0]?.value,
    recordsBySource,
    recordsByDenom,
    goldLatest,
    goldLastFetch: goldLastFetch[0]?.value,
    newsCount: newsCount[0]?.value ?? 0,
    newsLastFetch: newsLastFetch[0]?.value,
  };
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "Never";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "N/A";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function ScraperPage() {
  const stats = await getScraperStats();

  const totalRecords = stats.recordsBySource.reduce((a, b) => a + b.total, 0);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[#0f172a]">Scraper Status</h1>
        <p className="text-sm text-gray-400 mt-1">
          Data sources, scrape history, and manual triggers.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1">
            Last Scrape
          </p>
          <p className="text-sm font-bold text-[#0f172a]">{formatDate(stats.lastScrapeTime)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(stats.lastScrapeTime)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1">
            Total Records
          </p>
          <p className="text-lg font-mono font-bold text-[#0f172a]">
            {totalRecords.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1">
            Gold Last Fetched
          </p>
          <p className="text-sm font-bold text-[#0f172a]">{formatDate(stats.goldLastFetch)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(stats.goldLastFetch)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1">
            News Articles
          </p>
          <p className="text-lg font-mono font-bold text-[#0f172a]">
            {stats.newsCount.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Last: {timeAgo(stats.newsLastFetch)}</p>
        </div>
      </div>

      {/* Records by source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Records by Source
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Source
                </th>
                <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Records
                </th>
                <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recordsBySource.map((row) => (
                <tr key={row.source} className="border-b border-gray-50">
                  <td className="px-5 py-2.5 font-mono text-xs">{row.source}</td>
                  <td className="px-5 py-2.5 text-right font-mono font-bold">
                    {row.total.toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-400">
                    {totalRecords > 0 ? ((row.total / totalRecords) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Records by Denomination
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Denomination
                </th>
                <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Records
                </th>
                <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recordsByDenom.map((row) => (
                <tr key={row.denomination} className="border-b border-gray-50">
                  <td className="px-5 py-2.5">Rs. {row.denomination.toLocaleString()}</td>
                  <td className="px-5 py-2.5 text-right font-mono font-bold">
                    {row.total.toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-400">
                    {totalRecords > 0 ? ((row.total / totalRecords) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gold/Silver Prices */}
      {stats.goldLatest.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Latest Gold/Metal Prices
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Karat
                </th>
                <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Unit
                </th>
                <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Price (PKR)
                </th>
                <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Recorded
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.goldLatest.map((row, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-5 py-2.5 font-mono text-xs font-bold">{row.karat}</td>
                  <td className="px-5 py-2.5 text-xs">{row.unit}</td>
                  <td className="px-5 py-2.5 text-right font-mono font-bold text-amber-600">
                    {Number(row.pricePkr).toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-400">
                    {formatDate(row.recordedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scraper Actions (client component) */}
      <ScraperActions />
    </>
  );
}

import { db } from "@/lib/db";
import { devices, events, walletBonds, winners } from "@/lib/schema";
import { count, sql, eq } from "drizzle-orm";

async function getOverviewStats() {
  const today = new Date().toISOString().slice(0, 10);

  const [
    totalDevices,
    totalEvents,
    totalBonds,
    totalPrizes,
    activeToday,
    topSearched,
  ] = await Promise.all([
    db.select({ value: count() }).from(devices),
    db.select({ value: count() }).from(events),
    db.select({ value: count() }).from(walletBonds),
    db.select({ value: count() }).from(winners),
    db
      .select({ value: sql<number>`COUNT(DISTINCT ${events.deviceFingerprint})` })
      .from(events)
      .where(sql`${events.createdAt}::date = ${today}`),
    db
      .select({
        bondNumber: sql<string>`${events.eventData}->>'bondNumber'`,
        searches: count(),
      })
      .from(events)
      .where(eq(events.eventType, "search"))
      .groupBy(sql`${events.eventData}->>'bondNumber'`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5),
  ]);

  return {
    totalDevices: totalDevices[0]?.value ?? 0,
    totalEvents: totalEvents[0]?.value ?? 0,
    totalBonds: totalBonds[0]?.value ?? 0,
    totalPrizes: totalPrizes[0]?.value ?? 0,
    activeToday: activeToday[0]?.value ?? 0,
    topSearched: topSearched.filter((r) => r.bondNumber),
  };
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-2">
        {label}
      </p>
      <p
        className={`text-2xl font-mono font-bold ${
          accent ? "text-emerald-600" : "text-[#0f172a]"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && (
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      )}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const stats = await getOverviewStats();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[#0f172a]">Overview</h1>
        <p className="text-sm text-gray-400 mt-1">
          System health and key metrics at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Registered Devices"
          value={stats.totalDevices}
          sub="Total unique fingerprints"
        />
        <StatCard
          label="Events Tracked"
          value={stats.totalEvents}
          sub="All event types"
        />
        <StatCard
          label="Wallet Bonds"
          value={stats.totalBonds}
          sub="Saved across all users"
          accent
        />
        <StatCard
          label="Prize Records"
          value={stats.totalPrizes}
          sub="Winners database"
        />
        <StatCard
          label="Active Today"
          value={stats.activeToday}
          sub="Unique devices with events"
          accent
        />
        <StatCard
          label="Top Searches"
          value={stats.topSearched.length > 0 ? stats.topSearched[0].bondNumber : "-"}
          sub={
            stats.topSearched.length > 0
              ? `${stats.topSearched[0].searches} searches`
              : "No search data yet"
          }
        />
      </div>

      {stats.topSearched.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">
              Top 5 Most Searched Bond Numbers
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Rank
                </th>
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Bond Number
                </th>
                <th className="text-right px-5 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  Searches
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.topSearched.map((item, i) => (
                <tr key={item.bondNumber} className="border-b border-gray-50">
                  <td className="px-5 py-3 text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-5 py-3 font-mono font-bold">{item.bondNumber}</td>
                  <td className="px-5 py-3 text-right font-mono text-emerald-600">
                    {item.searches.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

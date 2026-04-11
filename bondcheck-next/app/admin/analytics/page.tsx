import { db } from "@/lib/db";
import { events, devices } from "@/lib/schema";
import { count, sql, eq, desc } from "drizzle-orm";

async function getAnalytics() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const [
    eventsByType,
    dailyUniques,
    topDenominations,
    timezoneDistribution,
    peakHours,
    deviceTypeBreakdown,
    browserBreakdown,
    osBreakdown,
  ] = await Promise.all([
    // Event breakdown by type
    db
      .select({
        eventType: events.eventType,
        total: count(),
      })
      .from(events)
      .groupBy(events.eventType)
      .orderBy(sql`COUNT(*) DESC`),

    // Daily unique devices (last 30 days)
    db
      .select({
        date: sql<string>`${events.createdAt}::date`,
        uniqueDevices: sql<number>`COUNT(DISTINCT ${events.deviceFingerprint})`,
      })
      .from(events)
      .where(sql`${events.createdAt}::date >= ${thirtyDaysStr}`)
      .groupBy(sql`${events.createdAt}::date`)
      .orderBy(sql`${events.createdAt}::date`),

    // Most popular denominations searched
    db
      .select({
        denomination: sql<string>`${events.eventData}->>'denomination'`,
        total: count(),
      })
      .from(events)
      .where(sql`${events.eventData}->>'denomination' IS NOT NULL`)
      .groupBy(sql`${events.eventData}->>'denomination'`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10),

    // Geographic distribution by timezone
    db
      .select({
        timezone: devices.timezone,
        total: count(),
      })
      .from(devices)
      .where(sql`${devices.timezone} IS NOT NULL`)
      .groupBy(devices.timezone)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10),

    // Peak usage hours (UTC)
    db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${events.createdAt})`,
        total: count(),
      })
      .from(events)
      .groupBy(sql`EXTRACT(HOUR FROM ${events.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${events.createdAt})`),

    // Device type breakdown
    db
      .select({
        deviceType: devices.deviceType,
        total: count(),
      })
      .from(devices)
      .groupBy(devices.deviceType)
      .orderBy(sql`COUNT(*) DESC`),

    // Browser breakdown
    db
      .select({
        browser: devices.browser,
        total: count(),
      })
      .from(devices)
      .groupBy(devices.browser)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10),

    // OS breakdown
    db
      .select({
        os: devices.os,
        total: count(),
      })
      .from(devices)
      .groupBy(devices.os)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10),
  ]);

  return {
    eventsByType,
    dailyUniques,
    topDenominations: topDenominations.filter((d) => d.denomination),
    timezoneDistribution,
    peakHours,
    deviceTypeBreakdown,
    browserBreakdown,
    osBreakdown,
  };
}

function BarChart({
  data,
  maxValue,
  color = "bg-emerald-500",
}: {
  data: { label: string; value: number }[];
  maxValue: number;
  color?: string;
}) {
  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-28 truncate text-right shrink-0" title={item.label}>
            {item.label}
          </span>
          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
            <div
              className={`h-full ${color} rounded transition-all`}
              style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-gray-600 w-16 text-right shrink-0">
            {item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  const totalEvents = data.eventsByType.reduce((acc, e) => acc + e.total, 0);
  const maxEventCount = data.eventsByType.length > 0 ? data.eventsByType[0].total : 0;
  const maxHourCount = data.peakHours.length > 0 ? Math.max(...data.peakHours.map((h) => h.total)) : 0;
  const maxDailyUnique = data.dailyUniques.length > 0 ? Math.max(...data.dailyUniques.map((d) => d.uniqueDevices)) : 0;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[#0f172a]">Analytics</h1>
        <p className="text-sm text-gray-400 mt-1">
          {totalEvents.toLocaleString()} total events tracked
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Event Breakdown */}
        <Section title="Event Breakdown by Type">
          {data.eventsByType.length > 0 ? (
            <BarChart
              data={data.eventsByType.map((e) => ({
                label: e.eventType,
                value: e.total,
              }))}
              maxValue={maxEventCount}
            />
          ) : (
            <p className="text-sm text-gray-400">No events yet.</p>
          )}
        </Section>

        {/* Daily Unique Devices (last 30 days) */}
        <Section title="Daily Unique Devices (Last 30 Days)">
          {data.dailyUniques.length > 0 ? (
            <div className="space-y-1">
              <div className="flex items-end gap-[2px] h-40">
                {data.dailyUniques.map((d) => (
                  <div
                    key={String(d.date)}
                    className="flex-1 bg-blue-500 rounded-t min-w-[4px] transition-all hover:bg-blue-600"
                    style={{
                      height: `${maxDailyUnique > 0 ? (d.uniqueDevices / maxDailyUnique) * 100 : 0}%`,
                      minHeight: d.uniqueDevices > 0 ? "2px" : "0px",
                    }}
                    title={`${String(d.date)}: ${d.uniqueDevices} devices`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                <span>{String(data.dailyUniques[0]?.date).slice(5)}</span>
                <span>{String(data.dailyUniques[data.dailyUniques.length - 1]?.date).slice(5)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data for last 30 days.</p>
          )}
        </Section>

        {/* Peak Usage Hours */}
        <Section title="Peak Usage Hours (UTC)">
          {data.peakHours.length > 0 ? (
            <div className="space-y-1">
              <div className="flex items-end gap-[2px] h-32">
                {Array.from({ length: 24 }, (_, i) => {
                  const hourData = data.peakHours.find((h) => Number(h.hour) === i);
                  const value = hourData?.total ?? 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-amber-400 rounded-t min-w-[4px] transition-all hover:bg-amber-500"
                      style={{
                        height: `${maxHourCount > 0 ? (value / maxHourCount) * 100 : 0}%`,
                        minHeight: value > 0 ? "2px" : "0px",
                      }}
                      title={`${i.toString().padStart(2, "0")}:00 — ${value.toLocaleString()} events`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No hourly data yet.</p>
          )}
        </Section>

        {/* Top Denominations */}
        <Section title="Most Popular Denominations">
          {data.topDenominations.length > 0 ? (
            <BarChart
              data={data.topDenominations.map((d) => ({
                label: `Rs. ${Number(d.denomination).toLocaleString()}`,
                value: d.total,
              }))}
              maxValue={data.topDenominations[0]?.total ?? 0}
              color="bg-violet-500"
            />
          ) : (
            <p className="text-sm text-gray-400">No denomination data yet.</p>
          )}
        </Section>

        {/* Geographic Distribution */}
        <Section title="Geographic Distribution (Timezone)">
          {data.timezoneDistribution.length > 0 ? (
            <BarChart
              data={data.timezoneDistribution.map((t) => ({
                label: t.timezone ?? "Unknown",
                value: t.total,
              }))}
              maxValue={data.timezoneDistribution[0]?.total ?? 0}
              color="bg-cyan-500"
            />
          ) : (
            <p className="text-sm text-gray-400">No timezone data yet.</p>
          )}
        </Section>

        {/* Device Type */}
        <Section title="Device Type Breakdown">
          {data.deviceTypeBreakdown.length > 0 ? (
            <div className="space-y-3">
              {data.deviceTypeBreakdown.map((d) => {
                const totalDevices = data.deviceTypeBreakdown.reduce((a, b) => a + b.total, 0);
                const pct = totalDevices > 0 ? ((d.total / totalDevices) * 100).toFixed(1) : "0";
                return (
                  <div key={d.deviceType ?? "null"} className="flex items-center gap-3">
                    <span
                      className={`inline-block w-20 px-2 py-0.5 rounded text-center text-[10px] font-bold uppercase tracking-wider ${
                        d.deviceType === "mobile"
                          ? "bg-blue-50 text-blue-600"
                          : d.deviceType === "tablet"
                          ? "bg-purple-50 text-purple-600"
                          : d.deviceType === "desktop"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-gray-50 text-gray-400"
                      }`}
                    >
                      {d.deviceType || "unknown"}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-600 w-20 text-right">
                      {d.total.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No device data yet.</p>
          )}
        </Section>

        {/* Browser Breakdown */}
        <Section title="Browser Breakdown">
          {data.browserBreakdown.length > 0 ? (
            <BarChart
              data={data.browserBreakdown.map((b) => ({
                label: b.browser ?? "Unknown",
                value: b.total,
              }))}
              maxValue={data.browserBreakdown[0]?.total ?? 0}
              color="bg-orange-500"
            />
          ) : (
            <p className="text-sm text-gray-400">No browser data yet.</p>
          )}
        </Section>

        {/* OS Breakdown */}
        <Section title="OS Breakdown">
          {data.osBreakdown.length > 0 ? (
            <BarChart
              data={data.osBreakdown.map((o) => ({
                label: o.os ?? "Unknown",
                value: o.total,
              }))}
              maxValue={data.osBreakdown[0]?.total ?? 0}
              color="bg-rose-500"
            />
          ) : (
            <p className="text-sm text-gray-400">No OS data yet.</p>
          )}
        </Section>
      </div>
    </>
  );
}

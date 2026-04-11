import { db } from "@/lib/db";
import { devices } from "@/lib/schema";
import { count, desc, sql } from "drizzle-orm";

const PAGE_SIZE = 50;

async function getDevices(page: number) {
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: devices.id,
        fingerprint: devices.fingerprint,
        os: devices.os,
        browser: devices.browser,
        deviceType: devices.deviceType,
        screenRes: devices.screenRes,
        timezone: devices.timezone,
        firstSeen: devices.firstSeen,
        lastSeen: devices.lastSeen,
        totalSessions: devices.totalSessions,
      })
      .from(devices)
      .orderBy(desc(devices.lastSeen))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ value: count() }).from(devices),
  ]);

  return {
    rows,
    total: totalResult[0]?.value ?? 0,
    page,
    totalPages: Math.ceil((totalResult[0]?.value ?? 0) / PAGE_SIZE),
  };
}

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const data = await getDevices(page);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0f172a]">Users / Devices</h1>
          <p className="text-sm text-gray-400 mt-1">
            {data.total.toLocaleString()} registered devices
          </p>
        </div>
        <div className="text-xs text-gray-400 font-mono">
          Page {data.page} of {data.totalPages}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Fingerprint
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                OS
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Browser
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Type
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Screen
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Timezone
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                First Seen
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Last Seen
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Sessions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((device) => (
              <tr key={device.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600" title={device.fingerprint}>
                  {device.fingerprint.slice(0, 12)}...
                </td>
                <td className="px-4 py-3 text-xs">{device.os || "-"}</td>
                <td className="px-4 py-3 text-xs">{device.browser || "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      device.deviceType === "mobile"
                        ? "bg-blue-50 text-blue-600"
                        : device.deviceType === "tablet"
                        ? "bg-purple-50 text-purple-600"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {device.deviceType || "unknown"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {device.screenRes || "-"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {device.timezone || "-"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {formatDate(device.firstSeen)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {formatDate(device.lastSeen)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold">
                  {device.totalSessions ?? 0}
                </td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">
                  No devices registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {data.page > 1 && (
            <a
              href={`/admin/devices?page=${data.page - 1}`}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Previous
            </a>
          )}
          {Array.from({ length: Math.min(data.totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (data.totalPages <= 7) {
              pageNum = i + 1;
            } else if (data.page <= 4) {
              pageNum = i + 1;
            } else if (data.page >= data.totalPages - 3) {
              pageNum = data.totalPages - 6 + i;
            } else {
              pageNum = data.page - 3 + i;
            }
            return (
              <a
                key={pageNum}
                href={`/admin/devices?page=${pageNum}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  pageNum === data.page
                    ? "bg-[#0f172a] text-white"
                    : "bg-white border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {pageNum}
              </a>
            );
          })}
          {data.page < data.totalPages && (
            <a
              href={`/admin/devices?page=${data.page + 1}`}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Next
            </a>
          )}
        </div>
      )}
    </>
  );
}

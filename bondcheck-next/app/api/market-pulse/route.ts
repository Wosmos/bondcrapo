import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import type { MarketPulse } from "@/types";

// Cache the aggregated pulse for 5 minutes
let cachedPulse: { data: MarketPulse; timestamp: number } | null = null;
const CACHE_TTL = 300_000; // 5 min

// ── Live fetchers (no DB dependency) ────────────────────────

async function fetchGoldLive(): Promise<MarketPulse["gold"]> {
  try {
    const res = await fetch(
      "https://goldpricez.com/api/rates/currency/pkr/measure/tola-pakistan",
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rates = Array.isArray(data) ? data : [data];
    if (!rates[0]?.price) return null;
    return { price_24k_tola: rates[0].price, change_label: null };
  } catch {
    return null;
  }
}

async function fetchSilverLive(): Promise<MarketPulse["silver"]> {
  try {
    const res = await fetch(
      "https://goldpricez.com/api/rates/currency/pkr/measure/tola-pakistan/metal/silver",
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rates = Array.isArray(data) ? data : [data];
    if (!rates[0]?.price) return null;
    const priceTola = rates[0].price;
    return { price_tola: priceTola, price_gram: Math.round((priceTola / 11.6638) * 100) / 100 };
  } catch {
    return null;
  }
}

async function fetchForexLive(): Promise<MarketPulse["usd_pkr"]> {
  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=PKR",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.rates?.PKR) return null;
    return { rate: data.rates.PKR, rate_type: "interbank" };
  } catch {
    return null;
  }
}

function getNextDrawFromSchedule(): MarketPulse["next_draw"] {
  // Hardcoded 2026 schedule — same as draw-schedule scraper
  const SCHEDULE: [number, string, string | null, number | null][] = [
    [100, "2026-02-16", "Quetta", 47], [100, "2026-05-15", "Lahore", 48],
    [100, "2026-08-17", "Peshawar", 49], [100, "2026-11-16", "Karachi", 50],
    [200, "2026-03-16", "Faisalabad", 101], [200, "2026-06-15", "Rawalpindi", 102],
    [200, "2026-09-15", "Multan", 103], [200, "2026-12-15", "Hyderabad", 104],
    [750, "2026-01-15", "Lahore", 110], [750, "2026-04-15", "Peshawar", 111],
    [750, "2026-07-15", "Rawalpindi", 112], [750, "2026-10-15", "Muzaffarabad", 113],
    [1500, "2026-02-17", "Karachi", 109], [1500, "2026-05-15", "Quetta", 110],
    [1500, "2026-08-17", "Lahore", 111], [1500, "2026-11-16", "Faisalabad", 112],
    [25000, "2026-03-10", "Rawalpindi", 30], [25000, "2026-06-10", "Lahore", 31],
    [25000, "2026-09-10", "Karachi", 32], [25000, "2026-12-10", "Peshawar", 33],
    [40000, "2026-03-02", "Multan", 28], [40000, "2026-06-02", "Karachi", 29],
    [40000, "2026-09-01", "Lahore", 30], [40000, "2026-12-01", "Rawalpindi", 31],
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let closest: import("@/types").DrawScheduleEntry | null = null;

  for (const [denom, dateStr, city, drawNum] of SCHEDULE) {
    const drawDate = new Date(dateStr + "T00:00:00");
    const diff = Math.ceil((drawDate.getTime() - today.getTime()) / 86400000);
    if (diff >= 0 && (closest === null || diff < closest.days_until!)) {
      closest = { denomination: denom, draw_date: dateStr, city, draw_number: drawNum, days_until: diff, status: "upcoming" };
    }
  }

  return closest;
}

// ── Route Handler ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "market-pulse");
  if (!rl.success) return rl.response!;

  if (cachedPulse && Date.now() - cachedPulse.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedPulse.data);
  }

  try {
    // Fetch all live data in parallel
    const [gold, silver, usdPkr] = await Promise.all([
      fetchGoldLive(),
      fetchSilverLive(),
      fetchForexLive(),
    ]);

    const nextDraw = getNextDrawFromSchedule();

    const pulse: MarketPulse = {
      gold,
      silver,
      usd_pkr: usdPkr,
      kse100: null, // No free reliable API for KSE-100
      next_draw: nextDraw,
      updated_at: new Date().toISOString(),
    };

    cachedPulse = { data: pulse, timestamp: Date.now() };
    return NextResponse.json(pulse);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

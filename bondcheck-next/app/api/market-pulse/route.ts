import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getLatestGoldPrices } from "@/lib/scrapers/gold";
import { getLatestForexRates } from "@/lib/scrapers/forex";
import { getLatestCryptoPrices } from "@/lib/scrapers/crypto";
import { getNextDraw } from "@/lib/scrapers/draw-schedule";
import type { MarketPulse } from "@/types";

// Cache the aggregated pulse for 60 seconds
let cachedPulse: { data: MarketPulse; timestamp: number } | null = null;
const CACHE_TTL = 60_000;

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "market-pulse");
  if (!rl.success) return rl.response!;

  if (cachedPulse && Date.now() - cachedPulse.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedPulse.data);
  }

  try {
    // Fetch all feeds in parallel — each returns null-safe data
    const [goldData, forexData, cryptoData, nextDraw] = await Promise.allSettled([
      getLatestGoldPrices(),
      getLatestForexRates(),
      getLatestCryptoPrices(),
      getNextDraw(),
    ]);

    // Extract gold 24k tola price
    let gold: MarketPulse["gold"] = null;
    if (goldData.status === "fulfilled" && goldData.value.prices.length > 0) {
      const gold24kTola = goldData.value.prices.find(
        (p) => p.karat === "24k" && p.unit === "tola"
      );
      if (gold24kTola) {
        gold = {
          price_24k_tola: gold24kTola.price_pkr,
          change_label: null,
        };
      }
    }

    // Extract USD/PKR rate
    let usdPkr: MarketPulse["usd_pkr"] = null;
    if (forexData.status === "fulfilled" && forexData.value.rates.length > 0) {
      const usd = forexData.value.rates.find((r) => r.base_currency === "USD");
      if (usd) {
        usdPkr = { rate: usd.rate, rate_type: usd.rate_type };
      }
    }

    // Extract BTC and ETH prices
    let crypto: MarketPulse["crypto"] = null;
    if (cryptoData.status === "fulfilled" && cryptoData.value.prices.length > 0) {
      const btc = cryptoData.value.prices.find((p) => p.symbol === "BTC");
      const eth = cryptoData.value.prices.find((p) => p.symbol === "ETH");
      crypto = {
        btc_usd: btc?.price_usd ?? null,
        eth_usd: eth?.price_usd ?? null,
      };
    }

    const pulse: MarketPulse = {
      gold,
      usd_pkr: usdPkr,
      crypto,
      kse100: null, // TODO: add when KSE scraper is built
      next_draw: nextDraw.status === "fulfilled" ? nextDraw.value : null,
      updated_at: new Date().toISOString(),
    };

    cachedPulse = { data: pulse, timestamp: Date.now() };

    return NextResponse.json(pulse);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

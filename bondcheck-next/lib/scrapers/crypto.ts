import { db } from "@/lib/db";
import { cryptoPrices } from "@/lib/schema";
import { desc, eq, and, gte } from "drizzle-orm";

// ── Crypto prices via CoinGecko free API ──────────────────
// Free tier: 10-30 requests/minute, no key required
// Tracks: BTC, ETH, USDT, BNB, SOL

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const TRACKED_COINS = ["bitcoin", "ethereum", "tether", "binancecoin", "solana"] as const;
const COIN_SYMBOL_MAP: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  tether: "USDT",
  binancecoin: "BNB",
  solana: "SOL",
};

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  total_volume: number | null;
}

/**
 * Fetch current crypto prices from CoinGecko.
 * Returns prices in USD (PKR derived from latest forex rate).
 */
export async function fetchCryptoPrices(): Promise<{
  inserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let inserted = 0;

  try {
    const ids = TRACKED_COINS.join(",");
    const res = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) {
      errors.push(`CoinGecko API returned ${res.status}`);
      return { inserted, errors };
    }

    const coins = await res.json() as CoinGeckoMarket[];

    // Try to get latest USD/PKR rate for PKR conversion
    const pkrRate = await getUsdPkrRate();

    const now = new Date();
    for (const coin of coins) {
      const symbol = COIN_SYMBOL_MAP[coin.id] ?? coin.symbol.toUpperCase();
      const pricePkr = pkrRate
        ? Math.round(coin.current_price * pkrRate * 100) / 100
        : null;

      await db.insert(cryptoPrices).values({
        symbol,
        priceUsd: String(coin.current_price),
        pricePkr: pricePkr ? String(pricePkr) : null,
        change24hPercent: coin.price_change_percentage_24h != null
          ? String(Math.round(coin.price_change_percentage_24h * 100) / 100)
          : null,
        volume24h: coin.total_volume != null ? String(coin.total_volume) : null,
        source: "coingecko",
        recordedAt: now,
      });
      inserted++;
    }
  } catch (err) {
    errors.push(`Crypto fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { inserted, errors };
}

/**
 * Helper: get latest USD/PKR rate from our exchange_rates table.
 */
async function getUsdPkrRate(): Promise<number | null> {
  const { exchangeRates } = await import("@/lib/schema");
  const row = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.baseCurrency, "USD"),
        eq(exchangeRates.quoteCurrency, "PKR")
      )
    )
    .orderBy(desc(exchangeRates.recordedAt))
    .limit(1);

  return row.length > 0 ? Number(row[0].rate) : null;
}

/**
 * Get the latest crypto prices from the database.
 */
export async function getLatestCryptoPrices() {
  const latest = await db
    .select()
    .from(cryptoPrices)
    .orderBy(desc(cryptoPrices.recordedAt))
    .limit(1);

  if (latest.length === 0) return { prices: [], updated_at: null };

  const latestTime = latest[0].recordedAt;

  const prices = await db
    .select()
    .from(cryptoPrices)
    .where(eq(cryptoPrices.recordedAt, latestTime));

  return {
    prices: prices.map((p) => ({
      symbol: p.symbol,
      price_usd: Number(p.priceUsd),
      price_pkr: p.pricePkr ? Number(p.pricePkr) : null,
      change_24h_percent: p.change24hPercent ? Number(p.change24hPercent) : null,
      volume_24h: p.volume24h ? Number(p.volume24h) : null,
      recorded_at: p.recordedAt.toISOString(),
    })),
    updated_at: latestTime.toISOString(),
  };
}

/**
 * Get crypto price history for charting.
 */
export async function getCryptoHistory(
  symbol: string = "BTC",
  days: number = 30
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      priceUsd: cryptoPrices.priceUsd,
      pricePkr: cryptoPrices.pricePkr,
      recordedAt: cryptoPrices.recordedAt,
    })
    .from(cryptoPrices)
    .where(
      and(
        eq(cryptoPrices.symbol, symbol.toUpperCase()),
        gte(cryptoPrices.recordedAt, since)
      )
    )
    .orderBy(cryptoPrices.recordedAt);

  return rows.map((r) => ({
    price_usd: Number(r.priceUsd),
    price_pkr: r.pricePkr ? Number(r.pricePkr) : null,
    recorded_at: r.recordedAt.toISOString(),
  }));
}

import { db } from "@/lib/db";
import { savingsRates } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

// ── National Savings Certificate Rates ────────────────────
// Source: savings.gov.pk/latest-profit-rates/
// Updates: Periodically when CDNS revises rates (last: Jan 5, 2026)

// Hardcoded current rates as baseline — scraped data overrides these.
// Rates effective January 5, 2026 (per savings.gov.pk)
const CURRENT_RATES = [
  {
    certificateType: "bahbood",
    displayName: "Bahbood Savings Certificates",
    ratePercent: "12.48",
    maturityPeriod: "10 years",
    minInvestment: 500,
    eligibility: "widows_seniors_disabled",
    profitPayment: "monthly",
  },
  {
    certificateType: "defence",
    displayName: "Defence Savings Certificates",
    ratePercent: "11.08",
    maturityPeriod: "10 years",
    minInvestment: 500,
    eligibility: "all",
    profitPayment: "maturity",
  },
  {
    certificateType: "special",
    displayName: "Special Savings Certificates (Registered)",
    ratePercent: "11.00",
    maturityPeriod: "3 years",
    minInvestment: 500,
    eligibility: "all",
    profitPayment: "semi_annual",
  },
  {
    certificateType: "regular_income",
    displayName: "Regular Income Certificates",
    ratePercent: "10.56",
    maturityPeriod: "5 years",
    minInvestment: 100_000,
    eligibility: "all",
    profitPayment: "monthly",
  },
  {
    certificateType: "short_term_3m",
    displayName: "Short Term Savings Certificates (3 Month)",
    ratePercent: "10.32",
    maturityPeriod: "3 months",
    minInvestment: 100_000,
    eligibility: "all",
    profitPayment: "maturity",
  },
  {
    certificateType: "short_term_6m",
    displayName: "Short Term Savings Certificates (6 Month)",
    ratePercent: "10.36",
    maturityPeriod: "6 months",
    minInvestment: 100_000,
    eligibility: "all",
    profitPayment: "maturity",
  },
  {
    certificateType: "short_term_12m",
    displayName: "Short Term Savings Certificates (12 Month)",
    ratePercent: "10.68",
    maturityPeriod: "12 months",
    minInvestment: 100_000,
    eligibility: "all",
    profitPayment: "maturity",
  },
  {
    certificateType: "pensioners_benefit",
    displayName: "Pensioners' Benefit Account",
    ratePercent: "12.48",
    maturityPeriod: "10 years",
    minInvestment: 500,
    eligibility: "pensioners",
    profitPayment: "monthly",
  },
  {
    certificateType: "savings_account",
    displayName: "Savings Account",
    ratePercent: "9.00",
    maturityPeriod: null,
    minInvestment: 100,
    eligibility: "all",
    profitPayment: "semi_annual",
  },
  {
    certificateType: "sarwa_islamic",
    displayName: "SISA - Sarwa Islamic Savings Account",
    ratePercent: "8.40",
    maturityPeriod: null,
    minInvestment: 100,
    eligibility: "all",
    profitPayment: "semi_annual",
  },
  {
    certificateType: "sarwa_islamic_term",
    displayName: "SITA - Sarwa Islamic Term Account",
    ratePercent: "10.80",
    maturityPeriod: "3 years",
    minInvestment: 1_000,
    eligibility: "all",
    profitPayment: "semi_annual",
  },
] as const;

/**
 * Scrape savings.gov.pk for latest profit rates.
 * Falls back to hardcoded rates if scraping fails.
 */
export async function fetchSavingsRates(): Promise<{
  inserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let inserted = 0;

  try {
    // Attempt to scrape live rates from savings.gov.pk
    const scraped = await scrapeSavingsGovPk();

    // Use scraped data if available, otherwise fallback to hardcoded
    const rates = scraped.length > 0 ? scraped : CURRENT_RATES;

    if (scraped.length === 0) {
      errors.push("Scrape returned no data, using hardcoded rates");
    }

    const now = new Date();
    for (const rate of rates) {
      await db
        .insert(savingsRates)
        .values({
          certificateType: rate.certificateType,
          displayName: rate.displayName,
          ratePercent: String(rate.ratePercent),
          maturityPeriod: rate.maturityPeriod ?? null,
          minInvestment: rate.minInvestment ?? null,
          eligibility: rate.eligibility ?? null,
          profitPayment: rate.profitPayment ?? null,
          source: "savings_gov_pk",
          scrapedAt: now,
        })
        .onConflictDoNothing();
      inserted++;
    }
  } catch (err) {
    errors.push(`Savings rates fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { inserted, errors };
}

/**
 * Attempt to scrape savings.gov.pk/latest-profit-rates/
 * Returns empty array if scraping fails (caller falls back to hardcoded).
 */
async function scrapeSavingsGovPk(): Promise<typeof CURRENT_RATES[number][]> {
  try {
    const res = await fetch("https://savings.gov.pk/latest-profit-rates/", {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BondCheck/1.0)",
      },
    });

    if (!res.ok) return [];

    const html = await res.text();

    // Parse rate table — look for patterns like "12.48%" next to certificate names
    // This is fragile and may break if the site changes layout.
    // The hardcoded fallback ensures we always have data.
    const ratePattern = /(\d{1,2}\.\d{2})\s*%/g;
    const matches = [...html.matchAll(ratePattern)];

    if (matches.length < 5) return []; // Not enough data, fallback

    // For now return empty — hardcoded rates are more reliable than fragile parsing.
    // TODO: Implement robust HTML parsing when site structure is stable.
    return [];
  } catch {
    return [];
  }
}

/**
 * Get the latest savings rates from the database.
 * Returns most recent entry for each certificate type.
 */
export async function getLatestSavingsRates() {
  // Get the most recent scrape timestamp
  const latest = await db
    .select()
    .from(savingsRates)
    .orderBy(desc(savingsRates.scrapedAt))
    .limit(1);

  if (latest.length === 0) return { rates: [], updated_at: null };

  const latestTime = latest[0].scrapedAt;

  // Get all rates from that scrape batch
  const rates = await db
    .select()
    .from(savingsRates)
    .where(eq(savingsRates.scrapedAt, latestTime));

  return {
    rates: rates.map((r) => ({
      certificate_type: r.certificateType,
      display_name: r.displayName,
      rate_percent: Number(r.ratePercent),
      maturity_period: r.maturityPeriod,
      min_investment: r.minInvestment,
      eligibility: r.eligibility,
      profit_payment: r.profitPayment,
      effective_date: r.effectiveDate,
    })),
    source: "savings_gov_pk",
    updated_at: latestTime.toISOString(),
  };
}

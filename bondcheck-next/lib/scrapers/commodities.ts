import { db } from "@/lib/db";
import { commodityPrices } from "@/lib/schema";
import { desc, eq, and, inArray } from "drizzle-orm";

// ── Commodity categories ──────────────────────────────────

type CommodityCategory = "fuel" | "grocery";

interface CommoditySeed {
  commodity: string;
  display_name: string;
  unit: string;
  price_pkr: number;
  city: string | null;
  source: string;
  effective_date: string;
  category: CommodityCategory;
}

const FUEL_COMMODITIES: string[] = ["petrol", "diesel"];
const GROCERY_COMMODITIES: string[] = [
  "flour_atta",
  "sugar",
  "ghee",
  "cooking_oil",
  "rice_basmati",
  "dal_chana",
  "dal_masoor",
  "chicken",
  "eggs",
  "milk",
];

const DISPLAY_NAMES: Record<string, string> = {
  petrol: "Petrol",
  diesel: "Hi-Speed Diesel",
  flour_atta: "Flour (Atta)",
  sugar: "Sugar",
  ghee: "Ghee",
  cooking_oil: "Cooking Oil",
  rice_basmati: "Rice (Basmati)",
  dal_chana: "Dal Chana",
  dal_masoor: "Dal Masoor",
  chicken: "Chicken",
  eggs: "Eggs",
  milk: "Milk",
};

function getCategoryFor(commodity: string): CommodityCategory {
  return FUEL_COMMODITIES.includes(commodity) ? "fuel" : "grocery";
}

/**
 * Hardcoded current Pakistani commodity prices.
 * These change infrequently:
 *   - OGRA fuel prices change twice a month
 *   - Grocery prices change weekly (government utility stores / PBS)
 *
 * Can be replaced with a live scraper later.
 */
const CURRENT_PRICES: CommoditySeed[] = [
  // ── Fuel (OGRA, national) ──────────────────────────────
  {
    commodity: "petrol",
    display_name: "Petrol",
    unit: "liter",
    price_pkr: 252.1,
    city: null,
    source: "ogra",
    effective_date: "2026-04-01",
    category: "fuel",
  },
  {
    commodity: "diesel",
    display_name: "Hi-Speed Diesel",
    unit: "liter",
    price_pkr: 258.43,
    city: null,
    source: "ogra",
    effective_date: "2026-04-01",
    category: "fuel",
  },

  // ── Grocery (PBS / utility stores, national avg) ───────
  {
    commodity: "flour_atta",
    display_name: "Flour (Atta)",
    unit: "kg",
    price_pkr: 90,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
  {
    commodity: "sugar",
    display_name: "Sugar",
    unit: "kg",
    price_pkr: 135,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
  {
    commodity: "ghee",
    display_name: "Ghee",
    unit: "kg",
    price_pkr: 600,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
  {
    commodity: "cooking_oil",
    display_name: "Cooking Oil",
    unit: "kg",
    price_pkr: 540,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
  {
    commodity: "rice_basmati",
    display_name: "Rice (Basmati)",
    unit: "kg",
    price_pkr: 300,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
  {
    commodity: "dal_chana",
    display_name: "Dal Chana",
    unit: "kg",
    price_pkr: 300,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
  {
    commodity: "dal_masoor",
    display_name: "Dal Masoor",
    unit: "kg",
    price_pkr: 375,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
  {
    commodity: "chicken",
    display_name: "Chicken",
    unit: "kg",
    price_pkr: 500,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
  {
    commodity: "eggs",
    display_name: "Eggs",
    unit: "dozen",
    price_pkr: 350,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
  {
    commodity: "milk",
    display_name: "Milk",
    unit: "liter",
    price_pkr: 215,
    city: null,
    source: "pbs_avg",
    effective_date: "2026-04-07",
    category: "grocery",
  },
];

/**
 * Seed / refresh commodity prices into the database.
 * Inserts hardcoded current prices (idempotent — duplicates are fine
 * since we always query the latest by recorded_at).
 */
export async function seedCommodityPrices(): Promise<{
  inserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let inserted = 0;

  const now = new Date();

  for (const item of CURRENT_PRICES) {
    try {
      await db.insert(commodityPrices).values({
        commodity: item.commodity,
        unit: item.unit,
        pricePkr: String(item.price_pkr),
        city: item.city,
        source: item.source,
        effectiveDate: item.effective_date,
        recordedAt: now,
      });
      inserted++;
    } catch (err) {
      errors.push(
        `Failed to insert ${item.commodity}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { inserted, errors };
}

/**
 * Fetch the latest commodity prices from the database.
 * Optionally filter by category ('fuel' | 'grocery').
 */
export async function getLatestCommodityPrices(category?: CommodityCategory) {
  // Determine which commodities to fetch
  let commodityFilter: string[];
  if (category === "fuel") {
    commodityFilter = FUEL_COMMODITIES;
  } else if (category === "grocery") {
    commodityFilter = GROCERY_COMMODITIES;
  } else {
    commodityFilter = [...FUEL_COMMODITIES, ...GROCERY_COMMODITIES];
  }

  // Get the most recent recorded_at timestamp
  const latest = await db
    .select()
    .from(commodityPrices)
    .orderBy(desc(commodityPrices.recordedAt))
    .limit(1);

  if (latest.length === 0) {
    return { fuel: [], grocery: [], updated_at: null };
  }

  const latestTime = latest[0].recordedAt;

  // Get all prices from that timestamp for the requested commodities
  const prices = await db
    .select()
    .from(commodityPrices)
    .where(
      and(
        eq(commodityPrices.recordedAt, latestTime!),
        inArray(commodityPrices.commodity, commodityFilter)
      )
    );

  const fuel: Array<{
    commodity: string;
    display_name: string;
    unit: string;
    price_pkr: number;
    city: string | null;
    effective_date: string | null;
    category: "fuel" | "grocery";
  }> = [];

  const grocery: typeof fuel = [];

  for (const p of prices) {
    const item = {
      commodity: p.commodity,
      display_name: DISPLAY_NAMES[p.commodity] ?? p.commodity,
      unit: p.unit,
      price_pkr: Number(p.pricePkr),
      city: p.city,
      effective_date: p.effectiveDate,
      category: getCategoryFor(p.commodity),
    };

    if (item.category === "fuel") {
      fuel.push(item);
    } else {
      grocery.push(item);
    }
  }

  return {
    fuel,
    grocery,
    updated_at: latestTime?.toISOString() ?? null,
  };
}

"use server";

import { scrapeOne, getAllScrapeTargets, type ScrapeResult } from "@/lib/scraper-logic";

/** Server action: scrape a single source+denomination */
export async function scrapeTarget(
  source: "savings_gov_pk" | "prizeinfo_net",
  denomination: number
): Promise<ScrapeResult> {
  return scrapeOne(source, denomination);
}

/** Server action: get list of all targets */
export async function getScrapeTargets() {
  return getAllScrapeTargets();
}

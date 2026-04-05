"use server";

import {
  scrapeOne,
  getAllScrapeTargets,
  scrapeHistoricalRecords,
  scrapeHistoricalForDenom,
  getHistoricalTargets,
  scrapePkPrizeBond,
  getPkPrizeBondTargets,
  type ScrapeResult,
} from "@/lib/scraper-logic";

/** Server action: scrape a single source+denomination */
export async function scrapeTarget(
  source: "prizeinfo_net" | "pkprizebond_com",
  denomination: number
): Promise<ScrapeResult> {
  return scrapeOne(source, denomination);
}

/** Server action: get list of all targets */
export async function getScrapeTargets() {
  return getAllScrapeTargets();
}

/** Server action: scrape all historical first/second records from prizeinfo.net */
export async function scrapeAllHistorical(): Promise<ScrapeResult> {
  return scrapeHistoricalRecords();
}

/** Server action: scrape historical records for a single denomination */
export async function scrapeHistoricalDenom(denomination: number): Promise<ScrapeResult> {
  return scrapeHistoricalForDenom(denomination);
}

/** Server action: get historical scrape targets */
export async function getHistoricalScrapeTargets() {
  return getHistoricalTargets();
}

/** Server action: scrape pkprizebond.com for a single denomination */
export async function scrapePkPrizeBondDenom(denomination: number): Promise<ScrapeResult> {
  return scrapePkPrizeBond(denomination);
}

/** Server action: get pkprizebond.com targets */
export async function getPkPrizeBondScrapeTargets() {
  return getPkPrizeBondTargets();
}

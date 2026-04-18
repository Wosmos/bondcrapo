import type { DenominationCode } from "@bondcheck/shared";

/**
 * Where each piece of prize bond data comes from (PLAN section 4.1, ADR 0001). Every URL here
 * was checked by hand; robots.txt of both sites allows these paths.
 */
export const OFFICIAL_BASE = "https://savings.gov.pk";
export const OFFICIAL_LEGACY_BASE = "https://www.savings.gov.pk/latest";
export const PRIZEINFO_BASE = "https://www.prizeinfo.net";

/** Official denomination pages that list the TXT and PDF result uploads (about 15 recent draws each). */
export const OFFICIAL_PAGES: Partial<Record<DenominationCode, string>> = {
  "100": `${OFFICIAL_BASE}/rs-100-prize-bond-draw`,
  "200": `${OFFICIAL_BASE}/rs-200-prize-bond-draw`,
  "750": `${OFFICIAL_BASE}/rs-750-prize-bond-draw`,
  "1500": `${OFFICIAL_BASE}/rs-1500-prize-bond-draw`,
  "25000P": `${OFFICIAL_BASE}/premium-prize-bond-rs-25000`,
  "40000P": `${OFFICIAL_BASE}/premium-prize-bond-rs-40000`,
};

/** `country` ids of the official legacy search form (results.php), one per denomination. */
export const OFFICIAL_LEGACY_IDS: Record<DenominationCode, number> = {
  "100": 1,
  "200": 2,
  "750": 3,
  "1500": 4,
  "7500": 5,
  "15000": 6,
  "25000": 7,
  "40000": 8,
  "40000P": 9,
  "25000P": 10,
};

export const officialDateListUrl = (code: DenominationCode) =>
  `${OFFICIAL_LEGACY_BASE}/ajaxData.php#id=${OFFICIAL_LEGACY_IDS[code]}`;

/** The search answers one number per request; the URL records the form fields that were posted. */
export const officialSpotUrl = (code: DenominationCode, stateId: number, date: string, number: string) =>
  `${OFFICIAL_LEGACY_BASE}/results.php#country=${OFFICIAL_LEGACY_IDS[code]}&state=${stateId}&date=${date}&number=${number}`;

const PRIZEINFO_SLUGS: Record<DenominationCode, string> = {
  "100": "100",
  "200": "200",
  "750": "750",
  "1500": "1500",
  "7500": "7500",
  "15000": "15000",
  "25000": "25000",
  "40000": "40000",
  "25000P": "25000-premium",
  "40000P": "40000-premium",
};

export const prizeinfoRecordUrl = (code: DenominationCode) =>
  `${PRIZEINFO_BASE}/${PRIZEINFO_SLUGS[code]}-prize-bond-first-second-record/`;
export const prizeinfoScheduleUrl = (year: number) => `${PRIZEINFO_BASE}/schedule/${year}/`;

/** Reverse lookups used when a stored document is parsed again later. */
export function denominationForPageUrl(url: string): DenominationCode | null {
  const clean = url.replace(/\/+$/, "");
  for (const [code, page] of Object.entries(OFFICIAL_PAGES)) if (page === clean) return code as DenominationCode;
  return null;
}

export function denominationForPrizeinfoUrl(url: string): DenominationCode | null {
  const m = /\/([\w-]+)-prize-bond-first-second-record\/?$/.exec(url);
  if (!m) return null;
  for (const [code, slug] of Object.entries(PRIZEINFO_SLUGS)) if (slug === m[1]) return code as DenominationCode;
  return null;
}

export function denominationForLegacyId(id: number): DenominationCode | null {
  for (const [code, n] of Object.entries(OFFICIAL_LEGACY_IDS)) if (n === id) return code as DenominationCode;
  return null;
}

/** Hosts and their politeness gap. National Savings and prizeinfo.net both get at least 2 s. */
export const HOST_INTERVALS_MS: Record<string, number> = {
  "savings.gov.pk": 2000,
  "www.savings.gov.pk": 2500,
  "www.prizeinfo.net": 3000,
};

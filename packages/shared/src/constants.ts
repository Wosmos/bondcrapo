export const DENOMINATION_CODES = [
  "100",
  "200",
  "750",
  "1500",
  "7500",
  "15000",
  "25000",
  "40000",
  "25000P",
  "40000P",
] as const;

export type DenominationCode = (typeof DENOMINATION_CODES)[number];

export interface DenominationInfo {
  code: DenominationCode;
  faceValue: number;
  kind: "bearer" | "premium_registered";
  /** Whether new draws are still held. Authoritative state lives in the `denominations` table. */
  active: boolean;
}

export const DENOMINATIONS: readonly DenominationInfo[] = [
  { code: "100", faceValue: 100, kind: "bearer", active: true },
  { code: "200", faceValue: 200, kind: "bearer", active: true },
  { code: "750", faceValue: 750, kind: "bearer", active: true },
  { code: "1500", faceValue: 1500, kind: "bearer", active: true },
  { code: "7500", faceValue: 7500, kind: "bearer", active: false },
  { code: "15000", faceValue: 15000, kind: "bearer", active: false },
  { code: "25000", faceValue: 25000, kind: "bearer", active: false },
  { code: "40000", faceValue: 40000, kind: "bearer", active: false },
  { code: "25000P", faceValue: 25000, kind: "premium_registered", active: true },
  { code: "40000P", faceValue: 40000, kind: "premium_registered", active: true },
];

export const LOCALES = ["en", "ur"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const METALS = ["XAU", "XAG", "XPT", "XPD"] as const;
export type Metal = (typeof METALS)[number];

/** Countries with local metal rates in v1 (ISO 3166-1 alpha-2). */
export const RATE_COUNTRIES = ["PK", "AE", "SA", "QA", "KW", "OM", "BH", "GB", "US", "IN"] as const;

/** Name of the httpOnly wallet cookie on web. */
export const WALLET_COOKIE = "bc_wallet";

/** Maximum bond numbers a single check request may expand to. */
export const MAX_CHECK_NUMBERS = 1000;

/** Scheduled and on-demand jobs reachable through /api/v1/cron/{job}. */
export const CRON_JOBS = [
  "bonds-sync",
  "bonds-verify",
  "bonds-schedule",
  "wallet-notify",
  "metals-spot",
  "fx-daily",
  "pk-market",
  "local-rates-derive",
  "housekeeping",
] as const;
export type CronJobName = (typeof CRON_JOBS)[number];

/** Data sources named on /about/data (PLAN section 4). Text lives in `common.data.sources.<id>`. */
export interface SourceRef {
  id: string;
  url: string;
}

export const BOND_SOURCES: SourceRef[] = [
  { id: "nss", url: "https://savings.gov.pk/" },
  { id: "pkprizebond", url: "https://pkprizebond.com/" },
  { id: "prizeinfo", url: "https://prizeinfo.net/" },
];

export const MARKET_SOURCES: SourceRef[] = [
  { id: "goldapi", url: "https://gold-api.com/" },
  { id: "erapi", url: "https://www.exchangerate-api.com" },
  { id: "fawaz", url: "https://github.com/fawazahmed0/exchange-api" },
  { id: "sbp", url: "https://www.sbp.org.pk/" },
  { id: "fap", url: "https://www.forex.pk/" },
  { id: "app", url: "https://www.app.com.pk/" },
];

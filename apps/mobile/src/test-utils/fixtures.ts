/** Recorded response shapes (validated by the shared zod contracts in every test). */
export const WALLET_ID = "0190a1b2-0000-7000-8000-000000000001";
export const WALLET_TOKEN = "test_wallet_token_not_real_0001";
export const SYNC_CODE = "ABCD2345WXYZ";

export const drawSummary = {
  id: 501,
  denominationCode: "750",
  drawNumber: 104,
  drawDate: "2026-04-15",
  city: "Quetta",
  status: "verified" as const,
  completeness: "full" as const,
  resultChecksum: "a".repeat(64),
  publishedAt: "2026-04-15T12:00:00Z",
  verifiedAt: "2026-04-16T03:00:00Z",
};

export const drawDetail = {
  ...drawSummary,
  prizes: [
    { tier: 1, amountPkr: 1500000, winnersCount: 1, inferred: false },
    { tier: 2, amountPkr: 500000, winnersCount: 3, inferred: false },
    { tier: 3, amountPkr: 9300, winnersCount: 1696, inferred: false },
  ],
  tier1: ["482913"],
  tier2: ["105377", "640021", "911204"],
  sources: [
    {
      source: "savings_gov_pk",
      url: "https://savings.gov.pk/example.txt",
      sha256: "b".repeat(64),
      fetchedAt: "2026-04-15T13:00:00Z",
      role: "primary" as const,
      parsedCount: 1700,
    },
  ],
  notice: null,
};

export const localRatesPk = [
  { karat: 24, unit: "tola", price: 437836, kind: "reported" },
  { karat: 24, unit: "10g", price: 375377, kind: "reported" },
  { karat: 22, unit: "tola", price: 401350.5, kind: "derived" },
  { karat: 22, unit: "10g", price: 344095.6, kind: "derived" },
].map((r) => ({
  country: "PK",
  city: "",
  metal: "XAU",
  currency: "PKR",
  source: r.kind === "reported" ? "apsgja" : "derived",
  date: "2026-06-01",
  observedAt: "2026-06-01T10:00:00Z",
  ...r,
}));

export const appManifest = {
  version: "1.3.0",
  versionCode: 10300,
  url: "/api/v1/releases/download/bondcheck-1.3.0.apk",
  sha256: "d".repeat(64),
  size: 31_457_280,
  minSupportedVersionCode: 10000,
  notes: "Faster results and Urdu fixes.",
  publishedAt: "2026-06-10T09:00:00Z",
};

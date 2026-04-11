export interface Winner {
  id: number;
  source: string;
  denomination: number;
  draw_number: number | null;
  draw_date: string;
  draw_year: string | null;
  city: string | null;
  bond_number: string;
  prize_position: string;
  prize_amount: number;
  created_at: string | null;
}

export interface StatsResponse {
  total_winners: number;
  by_denomination: { denomination: number; count: number; total_amount: number }[];
  by_position: { prize_position: string; count: number; total_amount: number }[];
  last_update: string | null;
}

export interface DrawsResponse {
  draws: Winner[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchResponse {
  bond_number: string;
  wins: Winner[];
  total_wins: number;
}

export interface CheckMultipleResponse {
  results: Record<string, Winner[]>;
  checked: number;
  winners: number;
}

export type SearchMode = "single" | "multi" | "series" | "mixed";

export interface FilterState {
  searchMode: SearchMode;
  bondNumber: string;
  bondList: string;
  startBond: string;
  endBond: string;
  denomination: string;
  rank: string;
  year: string;
  city: string;
  minDraw: string;
  sortBy: string;
  sortOrder: "ASC" | "DESC";
  startDate: string;
  endDate: string;
  minAmount: string;
  rowLimit: number;
}

// ── Market Data Types ─────────────────────────────────────

export interface GoldPrice {
  karat: string;
  unit: string;
  price_pkr: number;
  price_usd: number | null;
  recorded_at: string;
}

export interface GoldResponse {
  prices: GoldPrice[];
  source: string;
  updated_at: string;
}

export interface ExchangeRate {
  base_currency: string;
  quote_currency: string;
  rate_type: string;
  rate: number;
  recorded_at: string;
}

export interface ForexResponse {
  rates: ExchangeRate[];
  source: string;
  updated_at: string;
}

export interface SilverPrice {
  unit: string;
  price_pkr: number;
  price_usd: number | null;
  recorded_at: string;
}

export interface SilverResponse {
  prices: SilverPrice[];
  source: string;
  updated_at: string;
}

export interface SavingsRate {
  certificate_type: string;
  display_name: string;
  rate_percent: number;
  maturity_period: string | null;
  min_investment: number | null;
  eligibility: string | null;
  profit_payment: string | null;
  effective_date: string | null;
}

export interface SavingsRatesResponse {
  rates: SavingsRate[];
  source: string;
  updated_at: string;
}

export interface DrawScheduleEntry {
  denomination: number;
  draw_number: number | null;
  draw_date: string;
  city: string | null;
  status: string;
  days_until: number | null;
}

export interface DrawScheduleResponse {
  upcoming: DrawScheduleEntry[];
  recent: DrawScheduleEntry[];
}

export interface MarketIndex {
  index_name: string;
  close_value: number | null;
  change_percent: number | null;
  trade_date: string;
}

export interface MarketPulse {
  gold: { price_24k_tola: number | null; change_label: string | null } | null;
  silver: { price_tola: number | null; price_gram: number | null } | null;
  usd_pkr: { rate: number | null; rate_type: string } | null;
  kse100: { value: number | null; change_percent: number | null } | null;
  next_draw: DrawScheduleEntry | null;
  updated_at: string;
}

// ── Commodity Price Types ────────────────────────────────

export interface CommodityPrice {
  commodity: string;
  display_name: string;
  unit: string;
  price_pkr: number;
  city: string | null;
  effective_date: string | null;
  category: "fuel" | "grocery";
}

export interface CommodityResponse {
  fuel: CommodityPrice[];
  grocery: CommodityPrice[];
  updated_at: string | null;
}

// ── Tax Calculator Types ──────────────────────────────────

export interface PrizeBondTax {
  gross_amount: number;
  tax_rate: number;
  tax_amount: number;
  net_amount: number;
  filer_status: "filer" | "non_filer";
}

// ── News Types ───────────────────────────────────────────

export interface NewsArticle {
  id: number;
  title: string;
  description: string | null;
  url: string;
  source_name: string | null;
  image_url: string | null;
  published_at: string | null;
  category: string | null;
}

export interface NewsResponse {
  articles: NewsArticle[];
  total: number;
}

export interface PriceAlert {
  id: number;
  alert_type: string;
  target_value: number | null;
  params: Record<string, unknown> | null;
  triggered: boolean;
  created_at: string;
}

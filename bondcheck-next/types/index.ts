export interface Winner {
  id: number;
  source: string;
  denomination: number;
  draw_date: string;
  draw_year: string | null;
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
  sortBy: string;
  sortOrder: "ASC" | "DESC";
  startDate: string;
  endDate: string;
  minAmount: string;
  rowLimit: number;
}

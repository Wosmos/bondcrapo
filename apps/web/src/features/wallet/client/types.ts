import type { z } from "zod";
import type {
  walletAnalyticsSchema,
  walletBondInputSchema,
  walletBondSchema,
  walletMatchSchema,
  walletProfileSchema,
} from "@bondcheck/shared";

export type WalletProfile = z.infer<typeof walletProfileSchema>;
export type WalletBond = z.infer<typeof walletBondSchema>;
export type WalletBondInput = z.infer<typeof walletBondInputSchema>;
export type WalletMatch = z.infer<typeof walletMatchSchema>;
export type WalletAnalytics = z.infer<typeof walletAnalyticsSchema>;

/** What the device keeps for instant and offline display. */
export interface WalletSnapshot {
  profile: WalletProfile;
  bonds: WalletBond[];
  matches: WalletMatch[];
  analytics: WalletAnalytics | null;
  /** ISO time of the last successful sync with the server. */
  savedAt: string;
}

export type ImportSource = "csv" | "xlsx" | "ocr" | "paste";

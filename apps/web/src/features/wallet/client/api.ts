import {
  ApiClient,
  createWallet,
  deleteWallet,
  deleteWalletBond,
  getWallet,
  importWalletBonds,
  listWalletBonds,
  listWalletMatches,
  markMatchesSeen,
  putWalletBonds,
  restoreWallet,
  rotateSyncCode,
  walletAnalytics,
} from "@bondcheck/shared";

/**
 * The wallet's API client and contracts. Loaded on demand by `WalletProvider` so zod and the
 * contracts are fetched after the page is interactive instead of in its initial JavaScript.
 */
export const client = new ApiClient({ credentials: "same-origin" });

export const endpoints = {
  createWallet,
  deleteWallet,
  deleteWalletBond,
  getWallet,
  importWalletBonds,
  listWalletBonds,
  listWalletMatches,
  markMatchesSeen,
  putWalletBonds,
  restoreWallet,
  rotateSyncCode,
  walletAnalytics,
};

import { z } from "zod";
import { bondNumberSchema, emptyResponseSchema, isoDateSchema, isoDateTimeSchema } from "./common";
import { defineEndpoint } from "./endpoint";
import { tierSchema } from "./bonds";

export const syncCodeSchema = z
  .string()
  .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{12}$/, "expected a 12 character sync code"));

/** Returned once on create and on restore: the client must store `token` and show `syncCode`. */
export const walletCredentialsSchema = z.object({
  walletId: z.string().uuid(),
  token: z.string(),
  syncCode: z.string(),
});
export type WalletCredentialsResponse = z.infer<typeof walletCredentialsSchema>;

export const walletProfileSchema = z.object({
  walletId: z.string().uuid(),
  locale: z.string().nullable(),
  timezone: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  lastSeenAt: isoDateTimeSchema,
  bondCount: z.number().int(),
  matchCount: z.number().int(),
  hasUnseenMatches: z.boolean(),
});

export const walletBondSchema = z.object({
  denominationCode: z.string(),
  bondNumber: bondNumberSchema,
  label: z.string().nullable(),
  addedAt: isoDateTimeSchema,
});

export const walletBondInputSchema = z.object({
  denominationCode: z.string().min(1).max(12),
  bondNumber: bondNumberSchema,
  label: z.string().max(80).optional(),
});

const MAX_BONDS_PER_REQUEST = 5000;

export const walletMatchSchema = z.object({
  drawId: z.number().int(),
  denominationCode: z.string(),
  drawNumber: z.number().int().nullable(),
  drawDate: isoDateSchema,
  bondNumber: bondNumberSchema,
  tier: tierSchema,
  amountPkr: z.number().int(),
  matchedAt: isoDateTimeSchema,
  seenAt: isoDateTimeSchema.nullable(),
});

export const walletAnalyticsSchema = z.object({
  totals: z.object({
    bonds: z.number().int(),
    faceValuePkr: z.number().int(),
    winsCount: z.number().int(),
    winningsPkr: z.number().int(),
  }),
  winsByYear: z.array(z.object({ year: z.number().int(), count: z.number().int(), amountPkr: z.number().int() })),
  winsByTier: z.array(z.object({ tier: tierSchema, count: z.number().int(), amountPkr: z.number().int() })),
  nearMisses: z.array(
    z.object({
      bondNumber: bondNumberSchema,
      denominationCode: z.string(),
      drawId: z.number().int(),
      drawDate: isoDateSchema,
      winningNumber: bondNumberSchema,
      tier: tierSchema,
      reason: z.enum(["one_digit_off", "last_five_digits"]),
    }),
  ),
  expectedValuePkrPerDraw: z.number(),
  upcomingDraws: z.array(
    z.object({ denominationCode: z.string(), drawDate: isoDateSchema, city: z.string().nullable() }),
  ),
});

export const createWallet = defineEndpoint({
  id: "wallets.create",
  method: "POST",
  path: "/wallets",
  auth: "none",
  body: z.object({ locale: z.string().max(10).optional(), timezone: z.string().max(64).optional() }),
  response: walletCredentialsSchema,
});

export const restoreWallet = defineEndpoint({
  id: "wallets.restore",
  method: "POST",
  path: "/wallets/restore",
  auth: "none",
  body: z.object({ syncCode: syncCodeSchema }),
  response: walletCredentialsSchema,
});

export const rotateSyncCode = defineEndpoint({
  id: "wallets.rotate-sync-code",
  method: "POST",
  path: "/wallets/me/sync-code",
  auth: "wallet",
  response: z.object({ syncCode: z.string() }),
});

export const getWallet = defineEndpoint({
  id: "wallets.me",
  method: "GET",
  path: "/wallets/me",
  auth: "wallet",
  response: walletProfileSchema,
});

export const deleteWallet = defineEndpoint({
  id: "wallets.delete",
  method: "DELETE",
  path: "/wallets/me",
  auth: "wallet",
  response: emptyResponseSchema,
});

export const listWalletBonds = defineEndpoint({
  id: "wallets.bonds-list",
  method: "GET",
  path: "/wallets/me/bonds",
  auth: "wallet",
  response: z.array(walletBondSchema),
});

export const putWalletBonds = defineEndpoint({
  id: "wallets.bonds-put",
  method: "PUT",
  path: "/wallets/me/bonds",
  auth: "wallet",
  body: z.object({ bonds: z.array(walletBondInputSchema).min(1).max(MAX_BONDS_PER_REQUEST) }),
  response: z.object({ added: z.number().int(), newMatches: z.number().int() }),
});

export const deleteWalletBond = defineEndpoint({
  id: "wallets.bonds-delete",
  method: "DELETE",
  path: "/wallets/me/bonds/{denomination}/{number}",
  auth: "wallet",
  params: z.object({ denomination: z.string().min(1).max(12), number: bondNumberSchema }),
  response: emptyResponseSchema,
});

export const importWalletBonds = defineEndpoint({
  id: "wallets.bonds-import",
  method: "POST",
  path: "/wallets/me/bonds/import",
  auth: "wallet",
  body: z.object({
    source: z.enum(["csv", "xlsx", "ocr", "paste"]),
    bonds: z.array(walletBondInputSchema).min(1).max(MAX_BONDS_PER_REQUEST),
  }),
  response: z.object({ added: z.number().int(), skipped: z.number().int(), newMatches: z.number().int() }),
});

export const listWalletMatches = defineEndpoint({
  id: "wallets.matches",
  method: "GET",
  path: "/wallets/me/matches",
  auth: "wallet",
  response: z.array(walletMatchSchema),
});

export const markMatchesSeen = defineEndpoint({
  id: "wallets.matches-seen",
  method: "POST",
  path: "/wallets/me/matches/seen",
  auth: "wallet",
  body: z.object({
    matches: z.array(z.object({ drawId: z.number().int(), bondNumber: bondNumberSchema })).max(1000).optional(),
  }),
  response: z.object({ updated: z.number().int() }),
});

export const walletAnalytics = defineEndpoint({
  id: "wallets.analytics",
  method: "GET",
  path: "/wallets/me/analytics",
  auth: "wallet",
  response: walletAnalyticsSchema,
});

export const pushSubscriptionInputSchema = z.object({
  platform: z.enum(["webpush", "expo"]),
  endpoint: z.string().min(1).max(2048),
  keys: z.record(z.string(), z.string()).optional(),
});

export const subscribePush = defineEndpoint({
  id: "wallets.push-subscribe",
  method: "POST",
  path: "/wallets/me/push",
  auth: "wallet",
  body: pushSubscriptionInputSchema,
  response: emptyResponseSchema,
});

export const unsubscribePush = defineEndpoint({
  id: "wallets.push-unsubscribe",
  method: "DELETE",
  path: "/wallets/me/push",
  auth: "wallet",
  body: z.object({ endpoint: z.string().min(1).max(2048) }),
  response: emptyResponseSchema,
});

export const walletsEndpoints = {
  createWallet,
  restoreWallet,
  rotateSyncCode,
  getWallet,
  deleteWallet,
  listWalletBonds,
  putWalletBonds,
  deleteWalletBond,
  importWalletBonds,
  listWalletMatches,
  markMatchesSeen,
  walletAnalytics,
  subscribePush,
  unsubscribePush,
} as const;

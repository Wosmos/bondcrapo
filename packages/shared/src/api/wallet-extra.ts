import { z } from "zod";
import { defineEndpoint } from "./endpoint";

/**
 * Lane C additions to the wallet contracts (the M1 file `wallets.ts` is frozen).
 */

/** Public Web Push configuration. `vapidPublicKey` is null when push is not configured. */
export const getPushConfig = defineEndpoint({
  id: "wallets.push-config",
  method: "GET",
  path: "/wallets/push-config",
  auth: "none",
  response: z.object({ vapidPublicKey: z.string().nullable() }),
});

/** Error `details.reason` on 401 from wallet endpoints, so clients can explain what happened. */
export const walletAuthFailureReasonSchema = z.enum([
  /** No credentials were sent: this device has no wallet yet. */
  "missing",
  /** Credentials were sent but are no longer valid: restored elsewhere, or the wallet was deleted. */
  "revoked",
]);
export type WalletAuthFailureReason = z.infer<typeof walletAuthFailureReasonSchema>;

export const walletExtraEndpoints = { getPushConfig } as const;

import "server-only";
import { createWalletApi } from "./handlers";
import { defaultWalletDeps, vapidFromEnv } from "./deps";

/** The production wallet API: route files under app/api/v1/wallets re-export these handlers. */
export const walletApi = createWalletApi(defaultWalletDeps, () => vapidFromEnv()?.publicKey ?? null);

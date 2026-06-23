import * as SecureStore from "expo-secure-store";
import { z } from "zod";
import type { WalletCredentials } from "@bondcheck/shared";

const CREDENTIALS_KEY = "bondcheck.wallet.credentials";
const SYNC_CODE_KEY = "bondcheck.wallet.syncCode";

const storedSchema = z.object({
  walletId: z.string().uuid(),
  token: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/),
});

/** Keychain-backed storage; the token never touches AsyncStorage or logs. */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function readCredentials(): Promise<WalletCredentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, OPTIONS);
    if (!raw) return null;
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeCredentials(credentials: WalletCredentials, syncCode?: string): Promise<void> {
  const value = storedSchema.parse(credentials);
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(value), OPTIONS);
  if (syncCode) await SecureStore.setItemAsync(SYNC_CODE_KEY, syncCode, OPTIONS);
}

export async function readSyncCode(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SYNC_CODE_KEY, OPTIONS);
  } catch {
    return null;
  }
}

export async function writeSyncCode(syncCode: string): Promise<void> {
  await SecureStore.setItemAsync(SYNC_CODE_KEY, syncCode, OPTIONS);
}

export async function clearWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY, OPTIONS);
  await SecureStore.deleteItemAsync(SYNC_CODE_KEY, OPTIONS);
}

/** Formats a 12 character sync code as `XXXX-XXXX-XXXX` for reading aloud or copying. */
export function formatSyncCode(code: string): string {
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return clean.match(/.{1,4}/g)?.join("-") ?? clean;
}

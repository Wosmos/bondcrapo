import {
  createWallet,
  deleteWallet,
  restoreWallet,
  rotateSyncCode,
  type WalletCredentials,
} from "@bondcheck/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { clearCache } from "./cache";
import { clearWallet, readCredentials, readSyncCode, writeCredentials, writeSyncCode } from "./wallet-store";

export type WalletState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; walletId: string; syncCode: string | null };

interface WalletContextValue {
  state: WalletState;
  /** Creates an anonymous wallet; resolves with the sync code to show once. */
  create: (opts: { locale: string; timezone?: string }) => Promise<string>;
  restore: (syncCode: string) => Promise<string>;
  rotate: () => Promise<string>;
  /** Deletes the wallet on the server and forgets it on this phone. */
  remove: () => Promise<void>;
  /** Forgets the wallet on this phone only (used when the server no longer accepts the token). */
  forget: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export const WALLET_CACHE_KEYS = ["wallet.bonds", "wallet.matches", "wallet.profile"];

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({ status: "loading" });

  useEffect(() => {
    void (async () => {
      const credentials = await readCredentials();
      if (!credentials) return setState({ status: "none" });
      setState({ status: "ready", walletId: credentials.walletId, syncCode: await readSyncCode() });
    })();
  }, []);

  const adopt = useCallback(async (c: WalletCredentials & { syncCode: string }) => {
    await writeCredentials({ walletId: c.walletId, token: c.token }, c.syncCode);
    await clearCache(WALLET_CACHE_KEYS);
    setState({ status: "ready", walletId: c.walletId, syncCode: c.syncCode });
    return c.syncCode;
  }, []);

  const create = useCallback(
    async ({ locale, timezone }: { locale: string; timezone?: string }) => {
      const { data } = await api().call(createWallet, { body: { locale, timezone } });
      return adopt(data);
    },
    [adopt],
  );

  const restore = useCallback(
    async (syncCode: string) => {
      const { data } = await api().call(restoreWallet, { body: { syncCode } });
      return adopt(data);
    },
    [adopt],
  );

  const rotate = useCallback(async () => {
    const { data } = await api().call(rotateSyncCode);
    await writeSyncCode(data.syncCode);
    setState((s) => (s.status === "ready" ? { ...s, syncCode: data.syncCode } : s));
    return data.syncCode;
  }, []);

  const forget = useCallback(async () => {
    await clearWallet();
    await clearCache(WALLET_CACHE_KEYS);
    setState({ status: "none" });
  }, []);

  const remove = useCallback(async () => {
    await api().call(deleteWallet);
    await forget();
  }, [forget]);

  const value = useMemo(
    () => ({ state, create, restore, rotate, remove, forget }),
    [state, create, restore, rotate, remove, forget],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

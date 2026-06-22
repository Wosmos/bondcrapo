"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import {
  ApiClient,
  ApiError,
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
import { clearWalletCache, readPendingSyncCode, readSnapshot, writePendingSyncCode, writeSnapshot } from "./cache";
import type { ImportSource, WalletBond, WalletBondInput, WalletSnapshot } from "./types";

export type WalletStatus = "loading" | "anonymous" | "ready" | "revoked" | "unavailable";

/** Stable error codes the UI translates (never raw server messages). */
export type WalletErrorCode =
  | "network"
  | "rate_limited"
  | "not_found"
  | "conflict"
  | "bad_request"
  | "unauthorized"
  | "unavailable"
  | "internal";

export class WalletActionError extends Error {
  constructor(
    readonly code: WalletErrorCode,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

export interface AddResult {
  added: number;
  skipped: number;
  newMatches: number;
  /** True when this add created the wallet (the sync code card should be shown). */
  created: boolean;
}

interface WalletContextValue {
  status: WalletStatus;
  /** Showing the saved copy because the server could not be reached. */
  offline: boolean;
  snapshot: WalletSnapshot | null;
  pendingSyncCode: string | null;
  refresh(): Promise<void>;
  addBonds(bonds: WalletBondInput[], source?: ImportSource): Promise<AddResult>;
  removeBond(bond: Pick<WalletBond, "denominationCode" | "bondNumber">): Promise<void>;
  restore(syncCode: string): Promise<void>;
  rotateSyncCode(): Promise<string>;
  acknowledgeSyncCode(): Promise<void>;
  markAllSeen(): Promise<void>;
  deleteWallet(): Promise<void>;
  /** Forget the local copy of a wallet that is no longer open on this device. */
  forgetLocal(): Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const client = new ApiClient({ credentials: "same-origin" });

function toActionError(error: unknown): WalletActionError {
  if (error instanceof WalletActionError) return error;
  if (error instanceof ApiError) {
    if (error.code === "network" || error.code === "invalid_response") return new WalletActionError("network");
    const retry = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
    const known: WalletErrorCode[] = ["rate_limited", "not_found", "conflict", "bad_request", "unauthorized", "unavailable"];
    return new WalletActionError(known.includes(error.code as WalletErrorCode) ? (error.code as WalletErrorCode) : "internal", retry);
  }
  return new WalletActionError("network");
}

const authReason = (error: unknown) =>
  error instanceof ApiError && error.code === "unauthorized"
    ? ((error.details as { reason?: string } | undefined)?.reason ?? "revoked")
    : null;

const MAX_PER_REQUEST = 5000;

export function WalletProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [status, setStatus] = useState<WalletStatus>("loading");
  const [offline, setOffline] = useState(false);
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [pendingSyncCode, setPendingSyncCode] = useState<string | null>(null);
  const generation = useRef(0);
  const snapshotRef = useRef<WalletSnapshot | null>(null);
  const applySnapshot = useCallback((next: WalletSnapshot | null) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    try {
      const [profile, bonds, matches, analytics] = await Promise.all([
        client.call(getWallet),
        client.call(listWalletBonds),
        client.call(listWalletMatches),
        client.call(walletAnalytics).catch(() => null),
      ]);
      if (gen !== generation.current) return;
      const next: WalletSnapshot = {
        profile: profile.data,
        bonds: bonds.data,
        matches: matches.data,
        analytics: analytics?.data ?? snapshotRef.current?.analytics ?? null,
        savedAt: new Date().toISOString(),
      };
      applySnapshot(next);
      setStatus("ready");
      setOffline(false);
      void writeSnapshot(next);
    } catch (error) {
      if (gen !== generation.current) return;
      const reason = authReason(error);
      if (reason) {
        setOffline(false);
        setStatus(reason === "missing" && !snapshotRef.current ? "anonymous" : snapshotRef.current ? "revoked" : "anonymous");
        return;
      }
      const e = toActionError(error);
      if (e.code === "unavailable" || e.code === "internal") {
        setStatus(snapshotRef.current ? "ready" : "unavailable");
        setOffline(Boolean(snapshotRef.current));
        return;
      }
      // Network failure: fall back to the saved copy.
      setOffline(true);
      setStatus(snapshotRef.current ? "ready" : "unavailable");
    }
  }, [applySnapshot]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [saved, code] = await Promise.all([readSnapshot(), readPendingSyncCode()]);
      if (cancelled) return;
      if (saved) {
        applySnapshot(saved);
        setStatus("ready");
      }
      if (code) setPendingSyncCode(code);
      await load();
    })();
    const online = () => void load();
    const goneOffline = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", goneOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", goneOffline);
    };
  }, [load, applySnapshot]);

  const rememberCode = useCallback(async (code: string | null) => {
    setPendingSyncCode(code);
    await writePendingSyncCode(code);
  }, []);

  const ensureWallet = useCallback(async (): Promise<boolean> => {
    if (status === "ready" && !offline) return false;
    if (status === "ready" && offline) throw new WalletActionError("network");
    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      timezone = undefined;
    }
    const res = await client.call(createWallet, { body: { locale, timezone } });
    await rememberCode(res.data.syncCode);
    setStatus("ready");
    return true;
  }, [status, offline, locale, rememberCode]);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      offline,
      snapshot,
      pendingSyncCode,
      refresh: load,
      async addBonds(bonds, source) {
        try {
          const created = await ensureWallet();
          let added = 0;
          let skipped = 0;
          let newMatches = 0;
          for (let i = 0; i < bonds.length; i += MAX_PER_REQUEST) {
            const chunk = bonds.slice(i, i + MAX_PER_REQUEST);
            if (source) {
              const r = await client.call(importWalletBonds, { body: { source, bonds: chunk } });
              added += r.data.added;
              skipped += r.data.skipped;
              newMatches += r.data.newMatches;
            } else {
              const r = await client.call(putWalletBonds, { body: { bonds: chunk } });
              added += r.data.added;
              skipped += chunk.length - r.data.added;
              newMatches += r.data.newMatches;
            }
          }
          await load();
          return { added, skipped, newMatches, created };
        } catch (error) {
          throw toActionError(error);
        }
      },
      async removeBond(bond) {
        try {
          await client.call(deleteWalletBond, {
            params: { denomination: bond.denominationCode, number: bond.bondNumber },
          });
        } catch (error) {
          const e = toActionError(error);
          if (e.code !== "not_found") throw e;
        }
        await load();
      },
      async restore(syncCode) {
        try {
          generation.current++;
          const res = await client.call(restoreWallet, { body: { syncCode } });
          // The used code is retired by the server; the new one must be saved again.
          applySnapshot(null);
          await clearWalletCache();
          await rememberCode(res.data.syncCode);
          setStatus("loading");
          await load();
        } catch (error) {
          throw toActionError(error);
        }
      },
      async rotateSyncCode() {
        try {
          const res = await client.call(rotateSyncCode);
          await rememberCode(res.data.syncCode);
          return res.data.syncCode;
        } catch (error) {
          throw toActionError(error);
        }
      },
      async acknowledgeSyncCode() {
        await rememberCode(null);
      },
      async markAllSeen() {
        if (!snapshotRef.current?.matches.some((m) => m.seenAt === null)) return;
        try {
          await client.call(markMatchesSeen, { body: {} });
          await load();
        } catch {
          /* best effort: the badge stays until the next visit */
        }
      },
      async deleteWallet() {
        try {
          await client.call(deleteWallet);
        } catch (error) {
          const e = toActionError(error);
          if (e.code !== "unauthorized") throw e;
        }
        generation.current++;
        await clearWalletCache();
        applySnapshot(null);
        setPendingSyncCode(null);
        setStatus("anonymous");
      },
      async forgetLocal() {
        generation.current++;
        await clearWalletCache();
        applySnapshot(null);
        setPendingSyncCode(null);
        setStatus("anonymous");
      },
    }),
    [status, offline, snapshot, pendingSyncCode, load, ensureWallet, rememberCode, applySnapshot],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

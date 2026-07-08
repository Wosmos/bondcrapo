"use client";

import { Input } from "@/components/shadcn/input";
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, PageHeader, SelectField, Skeleton } from "@/components/ui";
import { useWallet, WalletActionError } from "../client/WalletProvider";
import { useWalletFormat } from "../client/format";
import type { WalletBond } from "../client/types";
import { AddBonds } from "./AddBonds";
import { BondNumber, Notice } from "./bits";

const PAGE_SIZE = 50;

function BondList() {
  const t = useTranslations("wallet.list");
  const tErr = useTranslations("wallet.errors");
  const f = useWalletFormat();
  const { snapshot, removeBond, addBonds, offline, status } = useWallet();
  const ids = useId();
  const [query, setQuery] = useState("");
  const [denom, setDenom] = useState("all");
  const [page, setPage] = useState(1);
  const [removed, setRemoved] = useState<WalletBond | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readOnly = offline || status !== "ready";

  const bonds = useMemo(() => snapshot?.bonds ?? [], [snapshot]);
  const wins = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of snapshot?.matches ?? []) {
      const k = `${w.denominationCode}:${w.bondNumber}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [snapshot]);
  const denominations = useMemo(() => [...new Set(bonds.map((b) => b.denominationCode))], [bonds]);
  const filtered = useMemo(() => {
    const q = query.replace(/\D/g, "");
    const text = query.trim().toLowerCase();
    return bonds.filter(
      (b) =>
        (denom === "all" || b.denominationCode === denom) &&
        (!text || (q && b.bondNumber.includes(q)) || (b.label ?? "").toLowerCase().includes(text)),
    );
  }, [bonds, query, denom]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  if (!snapshot) return null;
  if (bonds.length === 0) {
    return <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />;
  }

  async function remove(b: WalletBond) {
    setError(null);
    setBusyKey(`${b.denominationCode}:${b.bondNumber}`);
    try {
      await removeBond(b);
      setRemoved(b);
    } catch (e) {
      setError(tErr(e instanceof WalletActionError ? e.code : "network"));
    } finally {
      setBusyKey(null);
    }
  }

  async function undo() {
    if (!removed) return;
    const b = removed;
    setRemoved(null);
    try {
      await addBonds([{ denominationCode: b.denominationCode, bondNumber: b.bondNumber, ...(b.label ? { label: b.label } : {}) }]);
    } catch (e) {
      setError(tErr(e instanceof WalletActionError ? e.code : "network"));
    }
  }

  return (
    <section aria-labelledby={`${ids}-title`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={`${ids}-title`} className="text-lg font-semibold text-ink">
          {t("title", { count: bonds.length })}
        </h2>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-q`} className="text-sm font-medium">
              {t("search")}
            </label>
            <Input
              id={`${ids}-q`}
              type="search"
              inputMode="numeric"
              placeholder="123456"
              className="h-11 w-56 bg-surface"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {denominations.length > 1 ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-d`} className="text-sm font-medium">
                {t("filter")}
              </label>
              <SelectField
                id={`${ids}-d`}
                className="w-48"
                value={denom}
                onValueChange={(v) => {
                  setDenom(v);
                  setPage(1);
                }}
                options={[{ value: "all", label: t("all") }, ...denominations.map((d) => ({ value: d, label: f.denomination(d) }))]}
              />
            </div>
          ) : null}
        </div>
      </div>

      {removed ? (
        <Notice
          tone="info"
          live="polite"
          action={
            <Button variant="secondary" size="sm" onClick={undo}>
              {t("undo")}
            </Button>
          }
        >
          {t.rich("removed", { number: () => <BondNumber value={removed.bondNumber} /> })}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" live="assertive">
          {error}
        </Notice>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">
            {t("caption", { shown: visible.length, total: filtered.length })}
          </caption>
          <thead className="bg-surface-2 text-ink-2">
            <tr>
              <th scope="col" className="px-3 py-2 text-start font-semibold">{t("number")}</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">{t("denomination")}</th>
              <th scope="col" className="hidden px-3 py-2 text-start font-semibold sm:table-cell">{t("label")}</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">{t("status")}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold"><span className="sr-only">{t("actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => {
              const k = `${b.denominationCode}:${b.bondNumber}`;
              const winCount = wins.get(k) ?? 0;
              return (
                <tr key={k} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-start font-normal">
                    <BondNumber value={b.bondNumber} className="text-base" />
                  </th>
                  <td className="px-3 py-2">{f.denomination(b.denominationCode)}</td>
                  <td className="hidden px-3 py-2 text-ink-2 sm:table-cell">{b.label ?? ""}</td>
                  <td className="px-3 py-2">
                    {winCount > 0 ? (
                      <Badge tone="success">{t("won", { count: winCount })}</Badge>
                    ) : (
                      <span className="text-ink-2">{t("noWin")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={readOnly}
                      loading={busyKey === k}
                      onClick={() => void remove(b)}
                      aria-label={t("removeLabel", { number: b.bondNumber, denomination: f.denomination(b.denominationCode) })}
                    >
                      {t("remove")}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-2">
                  {t("noResults")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav aria-label={t("pagination")} className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            {t("previous")}
          </Button>
          <p className="text-sm text-ink-2" aria-live="polite">
            {t("page", { page: f.number(current), pages: f.number(pages) })}
          </p>
          <Button variant="secondary" disabled={current >= pages} onClick={() => setPage(current + 1)}>
            {t("next")}
          </Button>
        </nav>
      ) : null}
    </section>
  );
}

export function BondsView() {
  const t = useTranslations("wallet.bonds");
  const { status, snapshot } = useWallet();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <AddBonds />
      {status === "loading" && !snapshot ? <Skeleton label={t("loading")} size="h-40 w-full" /> : <BondList />}
    </div>
  );
}

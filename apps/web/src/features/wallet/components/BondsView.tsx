"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, DataTable, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { useWallet, WalletActionError } from "../client/WalletProvider";
import { useWalletFormat } from "../client/format";
import type { WalletBond } from "../client/types";
import { AddBonds } from "./AddBonds";
import { BondNumber, Notice } from "./bits";

function BondList() {
  const t = useTranslations("wallet.list");
  const tErr = useTranslations("wallet.errors");
  const f = useWalletFormat();
  const { snapshot, removeBond, addBonds, offline, status } = useWallet();
  const ids = useId();
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

      <DataTable
        caption={t("caption", { shown: bonds.length, total: bonds.length })}
        rows={bonds}
        getRowKey={(b) => `${b.denominationCode}:${b.bondNumber}`}
        fileName="bondcheck-my-bonds.csv"
        empty={t("noResults")}
        columns={[
          { key: "number", header: t("number"), value: (b) => b.bondNumber, cell: (b) => <BondNumber value={b.bondNumber} className="text-base" /> },
          { key: "denomination", header: t("denomination"), filter: "select", cell: (b) => f.denomination(b.denominationCode) },
          { key: "label", header: t("label"), filter: "select", cell: (b) => <span className="text-ink-2">{b.label ?? ""}</span> },
          {
            key: "status",
            header: t("status"),
            filter: "select",
            cell: (b) => {
              const winCount = wins.get(`${b.denominationCode}:${b.bondNumber}`) ?? 0;
              return winCount > 0 ? <Badge tone="success">{t("won", { count: winCount })}</Badge> : <span className="text-ink-2">{t("noWin")}</span>;
            },
          },
          {
            key: "actions",
            header: t("actions"),
            filter: false,
            value: () => "",
            cell: (b) => (
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                loading={busyKey === `${b.denominationCode}:${b.bondNumber}`}
                onClick={() => void remove(b)}
                aria-label={t("removeLabel", { number: b.bondNumber, denomination: f.denomination(b.denominationCode) })}
              >
                {t("remove")}
              </Button>
            ),
          },
        ]}
      />
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

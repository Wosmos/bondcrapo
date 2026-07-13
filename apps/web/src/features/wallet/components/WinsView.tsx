"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, Skeleton, Stat } from "@/components/ui";
import { useWallet } from "../client/WalletProvider";
import { useWalletFormat } from "../client/format";
import { isClaimed, readClaimed, subscribeClaimed, toggleClaimed } from "../client/claimed";
import { BondNumber, LinkButton } from "./bits";

export function WinsView() {
  const t = useTranslations("wallet.wins");
  const f = useWalletFormat();
  const { status, snapshot, markAllSeen, offline } = useWallet();
  const claimed = useSyncExternalStore(subscribeClaimed, readClaimed, () => "");
  const matches = useMemo(() => snapshot?.matches ?? [], [snapshot]);
  const hasUnseen = matches.some((m) => m.seenAt === null);
  // Wins that were new when the page opened keep their "New" badge for the whole visit.
  const [visitNew, setVisitNew] = useState<Set<string> | null>(null);
  if (visitNew === null && snapshot && status === "ready") {
    setVisitNew(new Set(matches.filter((m) => m.seenAt === null).map((m) => `${m.drawId}:${m.bondNumber}`)));
  }

  // Opening this page is how a person "sees" new wins; the "New" badges stay for this visit.
  useEffect(() => {
    if (!hasUnseen || offline || status !== "ready") return;
    const id = window.setTimeout(() => void markAllSeen(), 1500);
    return () => window.clearTimeout(id);
  }, [hasUnseen, offline, status, markAllSeen]);

  if (status === "loading" && !snapshot) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("title")} />
        <Skeleton label={t("loading")} size="h-40 w-full" />
      </div>
    );
  }

  const total = matches.reduce((n, m) => n + m.amountPkr, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      {matches.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={snapshot?.bonds.length ? t("emptyBodyWithBonds") : t("emptyBody")}
          action={snapshot?.bonds.length ? undefined : <LinkButton href="/my/bonds">{t("addBonds")}</LinkButton>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label={t("count")} value={f.number(matches.length)} />
            <Stat label={t("total")} value={f.rupees(total)} hint={t("beforeTax")} />
          </div>
          <DataTable
            caption={t("caption")}
            rows={matches}
            getRowKey={(m) => `${m.drawId}:${m.bondNumber}`}
            fileName="bondcheck-my-wins.csv"
            columns={[
              {
                key: "bond",
                header: t("bond"),
                value: (m) => m.bondNumber,
                cell: (m) => (
                  <>
                    <BondNumber value={m.bondNumber} className="text-base" />
                    {m.seenAt === null || visitNew?.has(`${m.drawId}:${m.bondNumber}`) ? (
                      <span className="ms-2">
                        <Badge tone="success">{t("new")}</Badge>
                      </span>
                    ) : null}
                  </>
                ),
              },
              {
                key: "drawDate",
                header: t("drawDate"),
                value: (m) => m.drawDate,
                cell: (m) => (
                  <>
                    <span className="block whitespace-nowrap">{f.date(m.drawDate)}</span>
                    <span className="block text-xs text-ink-2">
                      {f.denomination(m.denominationCode)}
                      {m.drawNumber ? ` · ${t("drawNo", { number: m.drawNumber })}` : ""}
                    </span>
                  </>
                ),
              },
              { key: "prize", header: t("prize"), filter: "select", cell: (m) => <span className="whitespace-nowrap">{f.tier(m.tier)}</span> },
              { key: "amount", header: t("amount"), numeric: true, value: (m) => m.amountPkr, cell: (m) => <span className="font-semibold">{f.rupees(m.amountPkr)}</span> },
              {
                key: "claimed",
                header: t("claimed"),
                filter: "select",
                value: (m) => (isClaimed(claimed, m) ? "☑" : "☐"),
                cell: (m) => {
                  const done = isClaimed(claimed, m);
                  return (
                    <Button size="sm" variant={done ? "primary" : "secondary"} aria-pressed={done} onClick={() => toggleClaimed(m)}>
                      <span aria-hidden="true">{done ? "☑" : "☐"}</span>
                      {t("claimedToggle")}
                      <span className="sr-only">{t("claimedFor", { number: m.bondNumber })}</span>
                    </Button>
                  );
                },
              },
            ]}
          />
          <p className="text-xs text-ink-2">{t("claimedNote")}</p>
        </>
      )}
      <Card title={t("howTitle")} headingLevel={2}>
        <ol className="list-decimal space-y-1 ps-5 text-sm text-ink-2">
          <li>{t("how1")}</li>
          <li>{t("how2")}</li>
          <li>{t("how3")}</li>
        </ol>
        <p className="mt-3 text-xs text-ink-2">{t("howNote")}</p>
      </Card>
    </div>
  );
}

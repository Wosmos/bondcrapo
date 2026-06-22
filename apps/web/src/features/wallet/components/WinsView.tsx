"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, Stat } from "@/components/ui";
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
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <caption className="px-3 py-2 text-start text-sm font-medium text-slate-700">{t("caption")}</caption>
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">{t("drawDate")}</th>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">{t("bond")}</th>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">{t("prize")}</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">{t("amount")}</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">{t("claimed")}</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => {
                  const done = isClaimed(claimed, m);
                  return (
                    <tr key={`${m.drawId}:${m.bondNumber}`} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <span className="block">{f.date(m.drawDate)}</span>
                        <span className="block text-xs text-slate-600">
                          {f.denomination(m.denominationCode)}
                          {m.drawNumber ? ` · ${t("drawNo", { number: m.drawNumber })}` : ""}
                        </span>
                      </td>
                      <th scope="row" className="px-3 py-3 text-start font-normal">
                        <BondNumber value={m.bondNumber} className="text-base" />
                        {m.seenAt === null || visitNew?.has(`${m.drawId}:${m.bondNumber}`) ? (
                          <span className="ms-2">
                            <Badge tone="success">{t("new")}</Badge>
                          </span>
                        ) : null}
                      </th>
                      <td className="px-3 py-3">{f.tier(m.tier)}</td>
                      <td className="px-3 py-3 text-end font-semibold tabular-nums">{f.rupees(m.amountPkr)}</td>
                      <td className="px-3 py-3 text-end">
                        <Button size="sm" variant={done ? "primary" : "secondary"} aria-pressed={done} onClick={() => toggleClaimed(m)}>
                          <span aria-hidden="true">{done ? "☑" : "☐"}</span>
                          {t("claimedToggle")}
                          <span className="sr-only">{t("claimedFor", { number: m.bondNumber })}</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600">{t("claimedNote")}</p>
        </>
      )}
      <Card title={t("howTitle")} headingLevel={2}>
        <ol className="list-decimal space-y-1 ps-5 text-sm text-slate-700">
          <li>{t("how1")}</li>
          <li>{t("how2")}</li>
          <li>{t("how3")}</li>
        </ol>
        <p className="mt-3 text-xs text-slate-600">{t("howNote")}</p>
      </Card>
    </div>
  );
}

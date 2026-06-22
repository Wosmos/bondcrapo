"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, PageHeader, Skeleton, Stat } from "@/components/ui";
import { useWallet } from "../client/WalletProvider";
import { useWalletFormat } from "../client/format";
import { claimedKey, readClaimed, subscribeClaimed, toggleClaimed } from "../client/claimed";
import { BondNumber, LinkButton, Ltr } from "./bits";

function Onboarding() {
  const t = useTranslations("wallet.onboarding");
  return (
    <section aria-labelledby="onboarding-title" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 id="onboarding-title" className="text-xl font-semibold text-slate-900">
        {t("title")}
      </h2>
      <p className="mt-2 max-w-prose text-slate-700">{t("lead")}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {(["noAccount", "automatic", "private"] as const).map((k) => (
          <li key={k} className="rounded-lg bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">{t(`${k}Title`)}</p>
            <p className="mt-1 text-sm text-slate-700">{t(`${k}Body`)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton href="/my/bonds">{t("addFirst")}</LinkButton>
        <LinkButton href="/my/restore" variant="secondary">
          {t("haveCode")}
        </LinkButton>
      </div>
    </section>
  );
}

function UnclaimedReminder() {
  const t = useTranslations("wallet.overview");
  const f = useWalletFormat();
  const { snapshot } = useWallet();
  const claimed = useSyncExternalStore(subscribeClaimed, readClaimed, () => "");
  const open = useMemo(
    () => (snapshot?.matches ?? []).filter((m) => !claimed.split("|").includes(claimedKey(m))),
    [snapshot, claimed],
  );
  if (open.length === 0) return null;
  const total = open.reduce((n, m) => n + m.amountPkr, 0);
  return (
    <Card
      title={t("unclaimedTitle")}
      actions={<LinkButton href="/my/wins" variant="ghost">{t("seeWins")}</LinkButton>}
    >
      <p className="text-sm text-slate-700">
        {t("unclaimedBody", { count: open.length, amount: f.rupees(total) })}
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {open.slice(0, 3).map((m) => (
          <li key={claimedKey(m)} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>
              <BondNumber value={m.bondNumber} /> <span className="text-slate-600">· {f.denomination(m.denominationCode)} · {f.date(m.drawDate)}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">{f.rupees(m.amountPkr)}</span>
              <Button size="sm" variant="secondary" onClick={() => toggleClaimed(m)}>
                {t("markClaimed")}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-600">{t("claimedLocalNote")}</p>
    </Card>
  );
}

function WinsByYear() {
  const t = useTranslations("wallet.overview");
  const f = useWalletFormat();
  const { snapshot } = useWallet();
  const rows = snapshot?.analytics?.winsByYear ?? [];
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.amountPkr), 1);
  return (
    <Card title={t("byYearTitle")}>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("byYearCaption")}</caption>
        <thead>
          <tr className="text-slate-600">
            <th scope="col" className="py-1 text-start font-medium">{t("year")}</th>
            <th scope="col" className="py-1 text-end font-medium">{t("wins")}</th>
            <th scope="col" className="py-1 text-end font-medium">{t("amount")}</th>
            <th scope="col" className="w-2/5 py-1"><span className="sr-only">{t("bar")}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year} className="border-t border-slate-100">
              <th scope="row" className="py-2 text-start font-medium"><Ltr>{r.year}</Ltr></th>
              <td className="py-2 text-end tabular-nums">{f.number(r.count)}</td>
              <td className="py-2 text-end tabular-nums">{f.rupees(r.amountPkr)}</td>
              <td className="py-2 ps-3" aria-hidden="true">
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-emerald-700" style={{ width: `${Math.max(4, (r.amountPkr / max) * 100)}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Upcoming() {
  const t = useTranslations("wallet.overview");
  const f = useWalletFormat();
  const { snapshot } = useWallet();
  const draws = snapshot?.analytics?.upcomingDraws ?? [];
  return (
    <Card title={t("upcomingTitle")}>
      {draws.length === 0 ? (
        <p className="text-sm text-slate-600">{t("upcomingEmpty")}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {draws.slice(0, 6).map((d) => (
            <li key={`${d.denominationCode}-${d.drawDate}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{f.denomination(d.denominationCode)}</span>
              <span className="text-slate-700">
                {f.date(d.drawDate)}
                {d.city ? ` · ${d.city}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Holdings() {
  const t = useTranslations("wallet.overview");
  const f = useWalletFormat();
  const { snapshot } = useWallet();
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of snapshot?.bonds ?? []) m.set(b.denominationCode, (m.get(b.denominationCode) ?? 0) + 1);
    return [...m].sort((a, b) => (Number.parseInt(a[0]) || 0) - (Number.parseInt(b[0]) || 0));
  }, [snapshot]);
  return (
    <Card title={t("holdingsTitle")} actions={<LinkButton href="/my/bonds" variant="ghost">{t("manageBonds")}</LinkButton>}>
      <ul className="flex flex-wrap gap-2">
        {groups.map(([code, n]) => (
          <li key={code} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm">
            <span className="font-medium">{f.denomination(code)}</span>
            <span className="text-slate-600"> × {f.number(n)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Overview() {
  const t = useTranslations("wallet.overview");
  const f = useWalletFormat();
  const { status, snapshot } = useWallet();
  const [showEv, setShowEv] = useState(false);

  if (status === "loading" && !snapshot) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("title")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} label={t("loading")} size="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!snapshot || snapshot.bonds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("emptyDescription")} />
        <Onboarding />
      </div>
    );
  }

  const a = snapshot.analytics;
  const totals = a?.totals ?? {
    bonds: snapshot.bonds.length,
    faceValuePkr: 0,
    winsCount: snapshot.matches.length,
    winningsPkr: snapshot.matches.reduce((n, m) => n + m.amountPkr, 0),
  };
  const unseen = snapshot.matches.filter((m) => m.seenAt === null).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<LinkButton href="/my/bonds">{t("addBonds")}</LinkButton>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("statBonds")} value={f.number(totals.bonds)} />
        <Stat label={t("statFaceValue")} value={f.rupees(totals.faceValuePkr)} />
        <Stat
          label={t("statWins")}
          value={f.number(totals.winsCount)}
          hint={unseen > 0 ? t("statNewWins", { count: unseen }) : undefined}
        />
        <Stat label={t("statWinnings")} value={f.rupees(totals.winningsPkr)} hint={t("beforeTax")} />
      </div>
      {unseen > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
          <span aria-hidden="true" className="text-xl">★</span>
          <p className="flex-1 font-medium">{t("newWinsBanner", { count: unseen })}</p>
          <LinkButton href="/my/wins" variant="secondary">{t("seeWins")}</LinkButton>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Holdings />
        <Upcoming />
        <UnclaimedReminder />
        {a ? (
          <Card
            title={t("evTitle")}
            actions={<Badge tone="info">{t("estimate")}</Badge>}
          >
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{f.rupeesPrecise(a.expectedValuePkrPerDraw)}</p>
            <p className="mt-1 text-sm text-slate-700">{t("evLead")}</p>
            <button
              type="button"
              className="mt-2 min-h-11 text-sm font-medium text-slate-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              aria-expanded={showEv}
              onClick={() => setShowEv((v) => !v)}
            >
              {t("evHow")}
            </button>
            {showEv ? <p className="mt-1 text-sm text-slate-700">{t("evExplain")}</p> : null}
          </Card>
        ) : null}
        <WinsByYear />
        {a && a.nearMisses.length > 0 ? (
          <Card title={t("nearMissTitle")} actions={<LinkButton href="/my/near-misses" variant="ghost">{t("seeAll")}</LinkButton>}>
            <p className="text-sm text-slate-700">{t("nearMissBody", { count: a.nearMisses.length })}</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

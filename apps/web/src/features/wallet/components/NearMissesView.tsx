"use client";

import { useTranslations } from "next-intl";
import { Badge, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { useWallet } from "../client/WalletProvider";
import { useWalletFormat } from "../client/format";
import { BondNumber, LinkButton } from "./bits";

/** Highlights the differing digits of `mine` against `winning`, with a text equivalent. */
function DigitDiff({ mine, winning, label }: { mine: string; winning: string; label: string }) {
  return (
    <bdi dir="ltr" className="font-mono text-base tabular-nums tracking-wider">
      <span className="sr-only">{label}</span>
      {[...mine].map((ch, i) =>
        ch === winning[i] ? (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ) : (
          <mark key={i} aria-hidden="true" className="rounded bg-gold/25 px-0.5 font-bold text-ink underline decoration-2">
            {ch}
          </mark>
        ),
      )}
    </bdi>
  );
}

export function NearMissesView() {
  const t = useTranslations("wallet.nearMisses");
  const f = useWalletFormat();
  const { status, snapshot } = useWallet();

  if (status === "loading" && !snapshot) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("title")} />
        <Skeleton label={t("loading")} size="h-40 w-full" />
      </div>
    );
  }

  const misses = snapshot?.analytics?.nearMisses ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <Badge tone="info">{t("forInterest")}</Badge>
        {t("disclaimer")}
      </p>
      {misses.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={snapshot?.bonds.length ? t("emptyBodyWithBonds") : t("emptyBody")}
          action={snapshot?.bonds.length ? undefined : <LinkButton href="/my/bonds">{t("addBonds")}</LinkButton>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {misses.map((m) => (
            <li key={`${m.drawId}:${m.bondNumber}:${m.winningNumber}`} className="rounded-lg border border-line bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-2">
                {f.denomination(m.denominationCode)} · {f.date(m.drawDate)} · {f.tier(m.tier)}
              </p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 text-sm">
                <dt className="text-ink-2">{t("yours")}</dt>
                <dd>
                  <DigitDiff mine={m.bondNumber} winning={m.winningNumber} label={m.bondNumber} />
                </dd>
                <dt className="text-ink-2">{t("winning")}</dt>
                <dd>
                  <BondNumber value={m.winningNumber} className="text-base" />
                </dd>
              </dl>
              <p className="mt-3 text-sm text-ink">
                {m.reason === "last_five_digits" ? t("reasonLastFive") : t("reasonOneDigit")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

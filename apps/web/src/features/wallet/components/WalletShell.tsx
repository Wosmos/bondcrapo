"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui";
import { WalletProvider, useWallet } from "../client/WalletProvider";
import { useWalletFormat } from "../client/format";
import { LinkButton, Notice } from "./bits";
import { SyncCodeCard } from "./SyncCodeCard";
import { LegacyHistoryBanner } from "./LegacyHistoryBanner";

const TABS = [
  { href: "/my", key: "overview" },
  { href: "/my/bonds", key: "bonds" },
  { href: "/my/wins", key: "wins" },
  { href: "/my/near-misses", key: "nearMisses" },
  { href: "/my/settings", key: "settings" },
] as const;

function Tabs() {
  const t = useTranslations("wallet.tabs");
  const pathname = usePathname();
  const { snapshot } = useWallet();
  const unseen = snapshot?.matches.filter((m) => m.seenAt === null).length ?? 0;
  return (
    <nav aria-label={t("label")} className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-1 border-b border-line px-1">
        {TABS.map((tab) => {
          const current = tab.href === "/my" ? pathname === "/my" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`relative -mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  current ? "border-brand text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {t(tab.key)}
                {tab.key === "wins" && unseen > 0 ? (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-on-brand">
                    <span aria-hidden="true">{unseen}</span>
                    <span className="sr-only">{t("newWins", { count: unseen })}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function StatusBanners() {
  const t = useTranslations("wallet.status");
  const f = useWalletFormat();
  const pathname = usePathname();
  const { status, offline, snapshot, pendingSyncCode, acknowledgeSyncCode, refresh, forgetLocal } = useWallet();

  return (
    <div className="flex flex-col gap-3 empty:hidden">
      {offline && snapshot ? (
        <Notice tone="warning" title={t("offlineTitle")} live="polite">
          {t("offlineBody", { time: f.dateTime(snapshot.savedAt) })}
        </Notice>
      ) : null}
      {status === "revoked" ? (
        <Notice
          tone="danger"
          title={t("revokedTitle")}
          live="polite"
          action={
            <>
              <LinkButton href="/my/restore" variant="primary">
                {t("revokedRestore")}
              </LinkButton>
              <Button variant="secondary" onClick={() => void forgetLocal()}>
                {t("revokedForget")}
              </Button>
            </>
          }
        >
          {t("revokedBody")}
        </Notice>
      ) : null}
      {status === "unavailable" ? (
        <Notice
          tone="warning"
          title={t("unavailableTitle")}
          live="polite"
          action={
            <Button variant="secondary" onClick={() => void refresh()}>
              {t("retry")}
            </Button>
          }
        >
          {t("unavailableBody")}
        </Notice>
      ) : null}
      {pendingSyncCode && status === "ready" && pathname !== "/my/settings" ? (
        <SyncCodeCard code={pendingSyncCode} onDone={() => void acknowledgeSyncCode()} />
      ) : null}
      {(status === "ready" || status === "anonymous") && !offline ? <LegacyHistoryBanner /> : null}
    </div>
  );
}

export function WalletShell({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Tabs />
        <StatusBanners />
        {children}
      </div>
    </WalletProvider>
  );
}

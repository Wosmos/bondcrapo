"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { BondTabs } from "@/components/shell/BondTabs";
import { Button } from "@/components/ui";
import { WalletProvider, useWallet } from "../client/WalletProvider";
import { useWalletFormat } from "../client/format";
import { LinkButton, Notice } from "./bits";
import { SyncCodeCard } from "./SyncCodeCard";
import { LegacyHistoryBanner } from "./LegacyHistoryBanner";

function Tabs() {
  const { snapshot } = useWallet();
  return <BondTabs newWins={snapshot?.matches.filter((m) => m.seenAt === null).length ?? 0} />;
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
      <div className="flex w-full flex-col gap-6">
        <Tabs />
        <StatusBanners />
        {children}
      </div>
    </WalletProvider>
  );
}

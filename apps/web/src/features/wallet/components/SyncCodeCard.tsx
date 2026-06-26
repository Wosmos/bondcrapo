"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { Announcer } from "./bits";
import { QrCode } from "./QrCode";

export function restoreLink(locale: string, code: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  // The code travels in the fragment, which browsers never send to the server or to logs.
  return `${origin}/${locale}/my/restore#code=${encodeURIComponent(code)}`;
}

/**
 * The single most important moment of a login-free wallet: the person sees their sync code,
 * keeps it (copy, download, screenshot the QR) and confirms. Shown until confirmed.
 */
export function SyncCodeCard({
  code,
  onDone,
  doneLabel,
  heading = "h2",
}: {
  code: string;
  onDone?: () => void;
  doneLabel?: string;
  heading?: "h2" | "h3";
}) {
  const t = useTranslations("wallet.syncCode");
  const locale = useLocale();
  const [announce, setAnnounce] = useState("");
  const [showQr, setShowQr] = useState(false);
  const H = heading;
  // Only ever rendered in the browser (the code comes from IndexedDB or an API response).
  const link = restoreLink(locale, code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setAnnounce(t("copied"));
    } catch {
      setAnnounce(t("copyFailed"));
    }
    window.setTimeout(() => setAnnounce(""), 4000);
  }

  function download() {
    const text = `${t("fileTitle")}\n\n${code}\n\n${t("fileRestore")}\n${link}\n\n${t("fileWarning")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "bondcheck-sync-code.txt";
    a.click();
    URL.revokeObjectURL(url);
    setAnnounce(t("downloaded"));
    window.setTimeout(() => setAnnounce(""), 4000);
  }

  return (
    <section
      aria-labelledby="sync-code-heading"
      className="rounded-xl border-2 border-brand bg-surface p-5 shadow-sm"
      data-testid="sync-code-card"
    >
      <H id="sync-code-heading" className="text-lg font-semibold text-ink">
        {t("title")}
      </H>
      <p className="mt-1 max-w-prose text-sm text-ink-2">{t("why")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <p
          className="rounded-lg bg-surface-2 px-4 py-3 font-mono text-2xl font-bold tracking-[0.2em] text-ink sm:text-3xl"
          data-testid="sync-code"
        >
          <bdi dir="ltr">{code}</bdi>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={copy}>
            {t("copy")}
          </Button>
          <Button variant="secondary" onClick={download} disabled={!link}>
            {t("download")}
          </Button>
          <Button variant="secondary" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
            {showQr ? t("hideQr") : t("showQr")}
          </Button>
        </div>
      </div>
      {showQr && link ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <QrCode value={link} label={t("qrLabel")} />
          <p className="max-w-xs text-sm text-ink-2">{t("qrHelp")}</p>
        </div>
      ) : null}
      <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-ink-2">
        <li>{t("tipPrivate")}</li>
        <li>{t("tipNoRecovery")}</li>
        <li>{t("tipRotates")}</li>
      </ul>
      {onDone ? (
        <div className="mt-4">
          <Button onClick={onDone}>{doneLabel ?? t("saved")}</Button>
        </div>
      ) : null}
      <Announcer message={announce} />
    </section>
  );
}

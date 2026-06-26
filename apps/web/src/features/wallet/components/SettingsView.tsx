"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, PageHeader } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useWallet, WalletActionError } from "../client/WalletProvider";
import { useWalletFormat } from "../client/format";
import { currentPushState, disablePush, enablePush, PushError, type PushState } from "../client/push";
import { exportPdf, exportXlsx } from "../client/export";
import { Dialog, Notice } from "./bits";
import { RestoreForm } from "./RestoreForm";
import { SyncCodeCard } from "./SyncCodeCard";

function SyncCodeSection() {
  const t = useTranslations("wallet.settings");
  const tErr = useTranslations("wallet.errors");
  const { pendingSyncCode, rotateSyncCode, acknowledgeSyncCode, status, offline } = useWallet();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "ready") return null;
  if (pendingSyncCode) {
    return <SyncCodeCard code={pendingSyncCode} onDone={() => void acknowledgeSyncCode()} />;
  }

  async function rotate() {
    setBusy(true);
    setError(null);
    try {
      await rotateSyncCode();
      setConfirm(false);
    } catch (e) {
      setError(tErr(e instanceof WalletActionError ? e.code : "network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("syncTitle")}>
      <p className="max-w-prose text-sm text-ink-2">{t("syncBody")}</p>
      <div className="mt-3">
        <Button variant="secondary" onClick={() => setConfirm(true)} disabled={offline}>
          {t("syncNew")}
        </Button>
      </div>
      {error ? (
        <div className="mt-3">
          <Notice tone="danger" live="assertive">
            {error}
          </Notice>
        </div>
      ) : null}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("syncConfirmTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={rotate} loading={busy}>
              {t("syncConfirm")}
            </Button>
          </>
        }
      >
        {t("syncConfirmBody")}
      </Dialog>
    </Card>
  );
}

function NotificationsSection() {
  const t = useTranslations("wallet.settings");
  const { status, offline } = useWallet();
  const [state, setState] = useState<PushState | "checking">("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    currentPushState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  if (status !== "ready") return null;

  async function toggle() {
    setBusy(true);
    setMessage(null);
    try {
      if (state === "on") {
        await disablePush();
        setState("off");
        setMessage({ tone: "success", text: t("pushOffDone") });
      } else {
        await enablePush();
        setState("on");
        setMessage({ tone: "success", text: t("pushOnDone") });
      }
    } catch (e) {
      const reason = e instanceof PushError ? e.reason : "failed";
      if (reason === "denied") setState("denied");
      if (reason === "unconfigured") setState("unconfigured");
      setMessage({ tone: "danger", text: t(`pushError.${reason}`) });
    } finally {
      setBusy(false);
    }
  }

  const on = state === "on";
  const unavailable = state === "unsupported" || state === "unconfigured" || state === "checking";
  return (
    <Card title={t("pushTitle")}>
      <p className="max-w-prose text-sm text-ink-2">{t("pushBody")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant={on ? "secondary" : "primary"}
          onClick={toggle}
          loading={busy}
          disabled={unavailable || state === "denied" || offline}
        >
          {on ? t("pushTurnOff") : t("pushTurnOn")}
        </Button>
        <p className="text-sm text-ink-2">{t(`pushState.${state}`)}</p>
      </div>
      {message ? (
        <div className="mt-3">
          <Notice tone={message.tone} live="polite">
            {message.text}
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}

function ExportSection() {
  const t = useTranslations("wallet.settings");
  const tx = useTranslations("wallet.export");
  const f = useWalletFormat();
  const { snapshot } = useWallet();
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const [failed, setFailed] = useState(false);
  if (!snapshot || snapshot.bonds.length === 0) return null;

  async function run(kind: "pdf" | "xlsx") {
    if (!snapshot) return;
    setBusy(kind);
    setFailed(false);
    try {
      if (kind === "pdf") await exportPdf(snapshot);
      else
        await exportXlsx(
          snapshot,
          {
            bondsSheet: tx("bondsSheet"),
            winsSheet: tx("winsSheet"),
            number: tx("number"),
            denomination: tx("denomination"),
            label: tx("label"),
            added: tx("added"),
            drawDate: tx("drawDate"),
            drawNumber: tx("drawNumber"),
            prize: tx("prize"),
            amount: tx("amount"),
          },
          f.tier,
        );
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title={t("exportTitle")}>
      <p className="max-w-prose text-sm text-ink-2">{t("exportBody")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => run("xlsx")} loading={busy === "xlsx"}>
          {t("exportXlsx")}
        </Button>
        <Button variant="secondary" onClick={() => run("pdf")} loading={busy === "pdf"}>
          {t("exportPdf")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-2">{t("exportPdfNote")}</p>
      {failed ? (
        <div className="mt-3">
          <Notice tone="danger" live="assertive">
            {t("exportFailed")}
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}

function DeleteSection() {
  const t = useTranslations("wallet.settings");
  const tErr = useTranslations("wallet.errors");
  const { deleteWallet, status, offline } = useWallet();
  const router = useRouter();
  const checkId = useId();
  const [open, setOpen] = useState(false);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status !== "ready") return null;

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteWallet();
      setOpen(false);
      router.push("/my");
    } catch (e) {
      setError(tErr(e instanceof WalletActionError ? e.code : "network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${checkId}-title`} className="rounded-lg border border-danger/40 bg-surface p-4">
      <h2 id={`${checkId}-title`} className="text-base font-semibold text-danger">
        {t("deleteTitle")}
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-2">{t("deleteBody")}</p>
      <div className="mt-3">
        <Button variant="danger" onClick={() => setOpen(true)} disabled={offline}>
          {t("deleteButton")}
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setSure(false);
        }}
        title={t("deleteConfirmTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" onClick={remove} disabled={!sure} loading={busy}>
              {t("deleteConfirm")}
            </Button>
          </>
        }
      >
        <p>{t("deleteConfirmBody")}</p>
        <label htmlFor={checkId} className="mt-3 flex min-h-11 items-center gap-2 font-medium text-ink">
          <input id={checkId} type="checkbox" className="size-5" checked={sure} onChange={(e) => setSure(e.target.checked)} />
          {t("deleteCheckbox")}
        </label>
        {error ? (
          <p role="alert" className="mt-2 font-medium text-danger">
            {error}
          </p>
        ) : null}
      </Dialog>
    </section>
  );
}

export function SettingsView() {
  const t = useTranslations("wallet.settings");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <SyncCodeSection />
      <RestoreForm />
      <NotificationsSection />
      <ExportSection />
      <Card title={t("privacyTitle")}>
        <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">
          <li>{t("privacyStored")}</li>
          <li>{t("privacyNotStored")}</li>
          <li>{t("privacyDevice")}</li>
        </ul>
        <p className="mt-3 text-sm">
          <Link href="/privacy" className="font-medium text-ink underline underline-offset-4">
            {t("privacyLink")}
          </Link>
        </p>
      </Card>
      <DeleteSection />
    </div>
  );
}

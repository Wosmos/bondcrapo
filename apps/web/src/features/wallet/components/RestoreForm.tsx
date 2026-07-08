"use client";

import { Checkbox } from "@/components/shadcn/checkbox";
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { formatSyncCode, normalizeSyncCode } from "@bondcheck/shared/wallet/secrets";
import { Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useWallet, WalletActionError } from "../client/WalletProvider";
import { Field, FieldInput, Notice } from "./bits";

/**
 * Opens a wallet on this device with its sync code. The server issues a new token and a new
 * code, so the old code stops working and the new one is shown for saving.
 */
export function RestoreForm({ initialCode = "", headingLevel = 2 }: { initialCode?: string; headingLevel?: 2 | 3 }) {
  const t = useTranslations("wallet.restore");
  const tErr = useTranslations("wallet.errors");
  const { restore, status, snapshot } = useWallet();
  const router = useRouter();
  const id = useId();
  const [code, setCode] = useState(initialCode ? formatSyncCode(initialCode) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const hasCurrent = status === "ready" && (snapshot?.bonds.length ?? 0) > 0;
  const H = `h${headingLevel}` as "h2" | "h3";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeSyncCode(code);
    if (!normalized) {
      setError(t("invalidFormat"));
      return;
    }
    if (hasCurrent && !confirmSwitch) {
      setError(t("confirmSwitchRequired"));
      return;
    }
    setBusy(true);
    try {
      await restore(normalized);
      router.push("/my");
    } catch (err) {
      if (err instanceof WalletActionError) {
        if (err.code === "not_found") setError(t("notFound"));
        else if (err.code === "rate_limited")
          setError(t("rateLimited", { minutes: Math.max(1, Math.ceil((err.retryAfterSeconds ?? 3600) / 60)) }));
        else setError(tErr(err.code));
      } else setError(tErr("network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-6">
      <H id={`${id}-title`} className="text-lg font-semibold text-ink">
        {t("title")}
      </H>
      <p className="mt-1 max-w-prose text-sm text-ink-2">{t("lead")}</p>
      <form className="mt-4 flex max-w-md flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field id={`${id}-code`} label={t("label")} hint={t("hint")} error={error}>
          <FieldInput
            id={`${id}-code`}
            hasHint
            error={Boolean(error)}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 16))}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            placeholder="XXXX-XXXX-XXXX"
            className="font-mono tracking-widest"
            data-testid="restore-code"
          />
        </Field>
        {hasCurrent ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <p>{t("switchWarning")}</p>
            <label className="mt-2 flex min-h-11 items-center gap-2 font-medium">
              <Checkbox className="size-5" checked={confirmSwitch} onCheckedChange={(v) => setConfirmSwitch(v === true)} />
              {t("switchConfirm")}
            </label>
          </div>
        ) : null}
        <div>
          <Button type="submit" loading={busy} size="lg">
            {t("submit")}
          </Button>
        </div>
      </form>
      <div className="mt-4">
        <Notice tone="info">{t("security")}</Notice>
      </div>
    </section>
  );
}

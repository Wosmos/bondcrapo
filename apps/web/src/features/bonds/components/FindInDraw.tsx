"use client";

import { useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { formatNumber } from "../format";

interface Props {
  /** URL of the draw's canonical `results.txt`. */
  listUrl: string;
  /** Amount per tier, when known. */
  amounts: Partial<Record<number, number>>;
}

type Outcome = { kind: "won"; number: string; tier: number } | { kind: "lost"; number: string } | { kind: "invalid" } | { kind: "error" } | null;

/**
 * Looks a number up in this draw on the device: the draw's canonical list (about 12 KB) is
 * fetched once on first use and searched locally. The outcome is announced politely.
 */
export function FindInDraw({ listUrl, amounts }: Props) {
  const t = useTranslations("bonds");
  const locale = useLocale();
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const list = useRef<Map<string, number> | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const n = value.replace(/\D/g, "");
    if (!/^\d{6}$/.test(n)) {
      setOutcome({ kind: "invalid" });
      return;
    }
    setBusy(true);
    try {
      if (!list.current) {
        const res = await fetch(listUrl);
        if (!res.ok) throw new Error(String(res.status));
        const map = new Map<string, number>();
        for (const line of (await res.text()).split("\n")) {
          const m = /^([123]):(\d{6})$/.exec(line.trim());
          if (m) map.set(m[2]!, Number(m[1]));
        }
        list.current = map;
      }
      const tier = list.current.get(n);
      setOutcome(tier ? { kind: "won", number: n, tier } : { kind: "lost", number: n });
    } catch {
      setOutcome({ kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  const tierName = (tier: number) => t(`common.tier.${tier}`).toLowerCase();
  let message: React.ReactNode = null;
  if (outcome?.kind === "won") {
    const amount = amounts[outcome.tier];
    message = (
      <p className="flex items-start gap-2 rounded-md border border-brand bg-success/10 p-3 text-success">
        <span aria-hidden="true">✓</span>
        <span>
          {amount
            ? t("draw.findWonAmount", { number: outcome.number, tier: tierName(outcome.tier), amount: t("common.rs", { amount: formatNumber(amount, locale) }) })
            : t("draw.findWon", { number: outcome.number, tier: tierName(outcome.tier) })}
        </span>
      </p>
    );
  } else if (outcome?.kind === "lost") {
    message = (
      <p className="flex items-start gap-2 rounded-md border border-line-strong bg-surface-2 p-3 text-ink">
        <span aria-hidden="true">✗</span>
        <span>{t("draw.findLost", { number: outcome.number })}</span>
      </p>
    );
  } else if (outcome?.kind === "invalid") {
    message = <p className="text-danger">{t("draw.findInvalid")}</p>;
  } else if (outcome?.kind === "error") {
    message = <p className="text-danger">{t("draw.findError")}</p>;
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className="rounded-lg border border-line bg-surface p-4">
      <h2 id={`${inputId}-title`} className="text-base font-semibold text-ink">
        {t("draw.findTitle")}
      </h2>
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-3" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {t("draw.findLabel")}
          </label>
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            dir="ltr"
            aria-describedby={hintId}
            aria-invalid={outcome?.kind === "invalid" || undefined}
            className="min-h-11 w-40 rounded-md border border-line-strong px-3 font-mono text-lg tracking-widest focus:border-brand focus:outline-2 focus:outline-focus"
          />
        </div>
        <Button type="submit" loading={busy} size="lg">
          {t("draw.findButton")}
        </Button>
        <p id={hintId} className="w-full text-sm text-ink-2">
          {t("draw.findHint")}
        </p>
      </form>
      <div aria-live="polite" className="mt-3 empty:hidden">
        {message}
      </div>
    </section>
  );
}

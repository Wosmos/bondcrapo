"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { parseBondList, MAX_BONDS_PER_ADD, type SheetBond } from "@bondcheck/shared/wallet/parse";
import { Button, SelectField } from "@/components/ui";
import { useWallet, WalletActionError, type AddResult } from "../client/WalletProvider";
import { ALL_DENOMINATIONS, useWalletFormat } from "../client/format";
import { FileTooLargeError, SCAN_ACCEPT, SHEET_ACCEPT, readSheetFile, scanFile } from "../client/files";
import type { ImportSource, WalletBondInput } from "../client/types";
import { Field, FieldInput, LinkButton, Notice, inputClass } from "./bits";

type Mode = "single" | "range" | "paste" | "file" | "scan";
const MODES: Mode[] = ["single", "range", "paste", "file", "scan"];
const LAST_DENOMINATION = "bc_last_denomination";

function savedDenomination(): string | null {
  try {
    const saved = localStorage.getItem(LAST_DENOMINATION);
    if (saved && ALL_DENOMINATIONS.includes(saved as (typeof ALL_DENOMINATIONS)[number])) return saved;
  } catch {
    /* ignore */
  }
  return null;
}
const noSubscribe = () => () => {};

interface Candidate {
  bonds: WalletBondInput[];
  source?: ImportSource;
  duplicates: number;
  invalid: string[];
  truncated: boolean;
}

export function AddBonds() {
  const t = useTranslations("wallet.add");
  const tErr = useTranslations("wallet.errors");
  const f = useWalletFormat();
  const { addBonds, snapshot, offline, status } = useWallet();
  const ids = useId();
  const [mode, setMode] = useState<Mode>("single");
  // The last used denomination is remembered on the device; the server render uses the default.
  const remembered = useSyncExternalStore(noSubscribe, savedDenomination, () => null);
  const [chosen, setChosen] = useState<string | null>(null);
  const denomination = chosen ?? remembered ?? "750";
  const [single, setSingle] = useState("");
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paste, setPaste] = useState("");
  const [sheet, setSheet] = useState<{ bonds: SheetBond[]; invalidRows: number; duplicates: number; source: "csv" | "xlsx"; name: string } | null>(null);
  const [scanText, setScanText] = useState("");
  const [scanState, setScanState] = useState<{ phase: "idle" | "working" | "done" | "error"; percent: number; error?: string }>({
    phase: "idle",
    percent: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<(AddResult & { requested: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const owned = useMemo(
    () => new Set((snapshot?.bonds ?? []).map((b) => `${b.denominationCode}:${b.bondNumber}`)),
    [snapshot],
  );

  const candidate = useMemo<Candidate>(() => {
    const withDenom = (numbers: string[]) => numbers.map((bondNumber) => ({ denominationCode: denomination, bondNumber }));
    switch (mode) {
      case "single": {
        const n = single.trim();
        if (!/^\d{6}$/.test(n)) return { bonds: [], duplicates: 0, invalid: n ? [n] : [], truncated: false };
        return {
          bonds: [{ denominationCode: denomination, bondNumber: n, ...(label.trim() ? { label: label.trim().slice(0, 80) } : {}) }],
          duplicates: 0,
          invalid: [],
          truncated: false,
        };
      }
      case "range": {
        if (!from && !to) return { bonds: [], duplicates: 0, invalid: [], truncated: false };
        const p = parseBondList(`${from.trim()}-${to.trim()}`, MAX_BONDS_PER_ADD);
        return { bonds: withDenom(p.numbers), duplicates: 0, invalid: p.invalid, truncated: p.truncated };
      }
      case "paste": {
        const p = parseBondList(paste);
        return { bonds: withDenom(p.numbers), source: "paste", duplicates: p.duplicates, invalid: p.invalid, truncated: p.truncated };
      }
      case "file": {
        if (!sheet) return { bonds: [], duplicates: 0, invalid: [], truncated: false };
        return {
          bonds: sheet.bonds.map((b) => ({
            denominationCode: b.denominationCode ?? denomination,
            bondNumber: b.bondNumber,
            ...(b.label ? { label: b.label } : {}),
          })),
          source: sheet.source,
          duplicates: sheet.duplicates,
          invalid: sheet.invalidRows ? [t("invalidRows", { count: sheet.invalidRows })] : [],
          truncated: false,
        };
      }
      case "scan": {
        const p = parseBondList(scanText);
        return { bonds: withDenom(p.numbers), source: "ocr", duplicates: p.duplicates, invalid: p.invalid, truncated: p.truncated };
      }
    }
  }, [mode, single, label, from, to, paste, sheet, scanText, denomination, t]);

  const alreadyOwned = candidate.bonds.filter((b) => owned.has(`${b.denominationCode}:${b.bondNumber}`)).length;
  const newCount = candidate.bonds.length - alreadyOwned;
  const rangeError =
    mode === "range" && touched && (from || to) && candidate.bonds.length === 0 ? t("rangeInvalid") : null;
  const singleError = mode === "single" && touched && single.trim() !== "" && candidate.bonds.length === 0 ? t("singleInvalid") : null;
  const readOnly = offline || status === "revoked" || status === "unavailable";

  function chooseDenomination(code: string) {
    setChosen(code);
    try {
      localStorage.setItem(LAST_DENOMINATION, code);
    } catch {
      /* ignore */
    }
  }

  async function onSheet(file: File | undefined) {
    setError(null);
    if (!file) return;
    try {
      const { sheet: s, source } = await readSheetFile(file);
      setSheet({ ...s, source, name: file.name });
      if (s.bonds.length === 0) setError(t("fileEmpty"));
    } catch (e) {
      setSheet(null);
      setError(e instanceof FileTooLargeError ? t("fileTooLarge") : t("fileUnreadable"));
    }
  }

  async function onScan(file: File | undefined) {
    setError(null);
    if (!file) return;
    setScanState({ phase: "working", percent: 0 });
    try {
      const numbers = await scanFile(file, (percent) => setScanState({ phase: "working", percent }));
      setScanText(numbers.join("\n"));
      setScanState({ phase: "done", percent: 100 });
    } catch (e) {
      setScanState({ phase: "error", percent: 0, error: e instanceof FileTooLargeError ? t("fileTooLarge") : t("scanFailed") });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    setResult(null);
    if (candidate.bonds.length === 0) {
      setError(mode === "single" ? t("singleInvalid") : t("nothingToAdd"));
      return;
    }
    setSubmitting(true);
    try {
      const r = await addBonds(candidate.bonds, candidate.source);
      setResult({ ...r, requested: candidate.bonds.length });
      setSingle("");
      setLabel("");
      setFrom("");
      setTo("");
      setPaste("");
      setSheet(null);
      setScanText("");
      setScanState({ phase: "idle", percent: 0 });
      setTouched(false);
      if (fileRef.current) fileRef.current.value = "";
      if (scanRef.current) scanRef.current.value = "";
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      const code = err instanceof WalletActionError ? err.code : "network";
      setError(tErr(code));
    } finally {
      setSubmitting(false);
    }
  }

  const modeHelpId = `${ids}-mode-help`;

  return (
    <section aria-labelledby={`${ids}-title`} className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-6">
      <h2 id={`${ids}-title`} className="text-lg font-semibold text-ink">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-ink-2">{t("lead")}</p>

      <form className="mt-4 flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <fieldset className="flex flex-col gap-2" disabled={readOnly} aria-describedby={modeHelpId}>
          <legend className="mb-2 text-sm font-medium text-ink">{t("howLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <label
                key={m}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                  mode === m ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name={`${ids}-mode`}
                  value={m}
                  checked={mode === m}
                  onChange={() => {
                    setMode(m);
                    setError(null);
                    setTouched(false);
                  }}
                  className="sr-only"
                />
                {t(`mode.${m}`)}
              </label>
            ))}
          </div>
          <p id={modeHelpId} className="text-xs text-ink-2">
            {t(`modeHelp.${mode}`)}
          </p>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2" disabled={readOnly}>
          <legend className="sr-only">{t("detailsLegend")}</legend>
          <Field id={`${ids}-denom`} label={mode === "file" ? t("denominationFallback") : t("denomination")}>
            <SelectField
              id={`${ids}-denom`}
              value={denomination}
              onValueChange={chooseDenomination}
              options={ALL_DENOMINATIONS.map((code) => ({ value: code, label: f.denomination(code) }))}
            />
          </Field>

          {mode === "single" ? (
            <>
              <Field id={`${ids}-single`} label={t("number")} hint={t("numberHint")} error={singleError}>
                <FieldInput
                  id={`${ids}-single`}
                  hasHint
                  error={Boolean(singleError)}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  pattern="\d{6}"
                  dir="ltr"
                  value={single}
                  onChange={(e) => setSingle(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onBlur={() => setTouched(true)}
                  data-testid="add-single"
                />
              </Field>
              <Field id={`${ids}-label`} label={t("label")} hint={t("labelHint")}>
                <FieldInput id={`${ids}-label`} hasHint maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
              </Field>
            </>
          ) : null}

          {mode === "range" ? (
            <>
              <Field id={`${ids}-from`} label={t("from")} error={rangeError}>
                <FieldInput
                  id={`${ids}-from`}
                  error={Boolean(rangeError)}
                  inputMode="numeric"
                  maxLength={6}
                  dir="ltr"
                  value={from}
                  onChange={(e) => setFrom(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onBlur={() => setTouched(true)}
                />
              </Field>
              <Field id={`${ids}-to`} label={t("to")} hint={t("rangeHint", { max: f.number(MAX_BONDS_PER_ADD) })}>
                <FieldInput
                  id={`${ids}-to`}
                  hasHint
                  inputMode="numeric"
                  maxLength={6}
                  dir="ltr"
                  value={to}
                  onChange={(e) => setTo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onBlur={() => setTouched(true)}
                />
              </Field>
            </>
          ) : null}

          {mode === "paste" ? (
            <div className="sm:col-span-2">
              <Field id={`${ids}-paste`} label={t("paste")} hint={t("pasteHint")}>
                <textarea
                  id={`${ids}-paste`}
                  aria-describedby={`${ids}-paste-hint`}
                  rows={6}
                  dir="ltr"
                  className={`${inputClass} min-h-32 py-2 font-mono`}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  data-testid="add-paste"
                />
              </Field>
            </div>
          ) : null}

          {mode === "file" ? (
            <div className="sm:col-span-2">
              <Field id={`${ids}-file`} label={t("file")} hint={t("fileHint")}>
                <input
                  ref={fileRef}
                  id={`${ids}-file`}
                  aria-describedby={`${ids}-file-hint`}
                  type="file"
                  accept={SHEET_ACCEPT}
                  className="block min-h-11 w-full text-sm file:me-3 file:min-h-11 file:rounded-md file:border-0 file:bg-brand file:px-4 file:text-on-brand"
                  onChange={(e) => void onSheet(e.target.files?.[0])}
                />
              </Field>
              {sheet ? (
                <p className="mt-2 text-sm text-ink-2">{t("fileRead", { name: sheet.name, count: sheet.bonds.length })}</p>
              ) : null}
            </div>
          ) : null}

          {mode === "scan" ? (
            <div className="flex flex-col gap-3 sm:col-span-2">
              <Field id={`${ids}-scan`} label={t("scan")} hint={t("scanHint")}>
                <input
                  ref={scanRef}
                  id={`${ids}-scan`}
                  aria-describedby={`${ids}-scan-hint`}
                  type="file"
                  accept={SCAN_ACCEPT}
                  capture="environment"
                  className="block min-h-11 w-full text-sm file:me-3 file:min-h-11 file:rounded-md file:border-0 file:bg-brand file:px-4 file:text-on-brand"
                  onChange={(e) => void onScan(e.target.files?.[0])}
                />
              </Field>
              {scanState.phase === "working" ? (
                <div role="status" className="flex items-center gap-3 text-sm text-ink-2">
                  <progress max={100} value={scanState.percent} className="h-2 w-40" aria-label={t("scanProgress")} />
                  {t("scanWorking", { percent: scanState.percent })}
                </div>
              ) : null}
              {scanState.phase === "error" ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  {scanState.error}
                </p>
              ) : null}
              {scanState.phase === "done" || scanText ? (
                <Field id={`${ids}-scan-review`} label={t("scanReview")} hint={t("scanReviewHint")}>
                  <textarea
                    id={`${ids}-scan-review`}
                    aria-describedby={`${ids}-scan-review-hint`}
                    rows={5}
                    dir="ltr"
                    className={`${inputClass} min-h-28 py-2 font-mono`}
                    value={scanText}
                    onChange={(e) => setScanText(e.target.value)}
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-ink" aria-live="polite">
            {candidate.bonds.length > 0 ? (
              <>
                <p className="font-medium">{t("summary", { count: candidate.bonds.length })}</p>
                <p className="text-ink-2">
                  {[
                    alreadyOwned ? t("summaryOwned", { count: alreadyOwned }) : null,
                    candidate.duplicates ? t("summaryDuplicates", { count: candidate.duplicates }) : null,
                    candidate.invalid.length ? t("summaryInvalid", { count: candidate.invalid.length, examples: candidate.invalid.slice(0, 3).join(", ") }) : null,
                    candidate.truncated ? t("summaryTruncated", { max: f.number(MAX_BONDS_PER_ADD) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            ) : (
              <p className="text-ink-2">{t("summaryNone")}</p>
            )}
          </div>
          <Button type="submit" size="lg" loading={submitting} disabled={readOnly || (touched && candidate.bonds.length === 0)}>
            {candidate.bonds.length > 0 && newCount === 0 ? t("submitUpdate") : t("submit", { count: newCount })}
          </Button>
        </div>
      </form>

      <div ref={resultRef} tabIndex={-1} className="mt-4 flex flex-col gap-3 outline-none empty:hidden">
        {error ? (
          <Notice tone="danger" live="assertive" title={t("errorTitle")}>
            {error}
          </Notice>
        ) : null}
        {readOnly && !error ? (
          <Notice tone="warning">{t("readOnly")}</Notice>
        ) : null}
        {result ? (
          <Notice
            tone="success"
            live="polite"
            title={t("addedTitle", { count: result.added })}
            action={
              result.newMatches > 0 ? (
                <LinkButton href="/my/wins" variant="secondary">
                  {t("seeWins")}
                </LinkButton>
              ) : undefined
            }
          >
            <p>
              {[
                result.skipped > 0 ? t("addedSkipped", { count: result.skipped }) : null,
                result.newMatches > 0 ? t("addedWins", { count: result.newMatches }) : t("addedNoWins"),
                result.created ? t("addedCreated") : null,
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
          </Notice>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { readSheetFile } from "@/features/wallet/client/files";
import { Input } from "@/components/shadcn/input";
import { Textarea } from "@/components/shadcn/textarea";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MAX_CHECK_NUMBERS, type DenominationCode } from "@bondcheck/shared";
import type { CheckResponseExtra } from "@bondcheck/shared/api/bonds-extra";
import { Button, SelectField } from "@/components/ui";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { Link } from "@/i18n/navigation";
import { formatDrawDate, formatNumber } from "../format";
import { DISPLAY_ORDER, denominationSlug } from "../labels";
import { parseBondHoldings, type SheetBond } from "@bondcheck/shared/wallet/parse";
import { numbersFromFile } from "../ocr";
import { BondNumber } from "./BondNumber";
import { useWallet } from "@/features/wallet/client/WalletProvider";

interface Range {
  from: string;
  to: string;
}

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; result: CheckResponseExtra }
  | { kind: "error"; message: string };

const API = "/api/v1/bonds/check";

/**
 * The bond checker: paste any text (six digit numbers are picked out), add ranges, optionally
 * read numbers from a photo or PDF on the device, then check them all against every draw. Up to
 * 1,000 numbers per check, as the API allows. Every state is announced; nothing is stored.
 */
export function Checker() {
  const t = useTranslations("bonds");
  const locale = useLocale();
  const ids = {
    text: useId(),
    textHint: useId(),
    from: useId(),
    to: useId(),
    rangeErr: useId(),
    denom: useId(),
    file: useId(),
    results: useId(),
  };
  const searchParams = useSearchParams();
  // Numbers handed over by the quick check form (`?numbers=`).
  const [initial] = useState(() => searchParams.get("numbers") ?? "");
  const [text, setText] = useState(initial);
  const [ranges, setRanges] = useState<Range[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);
  // `?denomination=` from the home page quick check preselects the filter when it is a known code.
  const [denomination, setDenomination] = useState<string>(() => {
    const d = searchParams.get("denomination") ?? "";
    return (DISPLAY_ORDER as readonly string[]).includes(d) ? d : "";
  });
  const [scan, setScan] = useState<
    | { kind: "idle" }
    | { kind: "working"; progress: number }
    | { kind: "done"; count: number }
    | { kind: "error" }
  >({ kind: "idle" });
  const [state, setState] = useState<State>({ kind: "idle" });
  const [formError, setFormError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const autoRun = useRef(false);
  // What the last check covered, so it can be saved to My bonds.
  const [checked, setChecked] = useState<SheetBond[]>([]);

  // A pasted list may have denomination lines ("Rs 750") that apply to the numbers below them.
  const numbers = useMemo(() => parseBondHoldings(text).bonds, [text]);
  const rangeTotal = ranges.reduce((a, r) => a + Number(r.to) - Number(r.from) + 1, 0);
  const total = numbers.length + rangeTotal;

  async function runCheck(nums: SheetBond[], rs: Range[]) {
    const count = nums.length + rs.reduce((a, r) => a + Number(r.to) - Number(r.from) + 1, 0);
    if (count === 0) {
      setFormError(t("check.nothingToCheck"));
      return;
    }
    if (count > MAX_CHECK_NUMBERS) {
      setFormError(
        t("check.tooMany", {
          count: formatNumber(count, locale),
          max: formatNumber(MAX_CHECK_NUMBERS, locale),
        }),
      );
      return;
    }
    const d = denomination || undefined;
    const expanded = rs.flatMap((r) => {
      const out: SheetBond[] = [];
      for (let n = Number(r.from); n <= Number(r.to); n++)
        out.push({
          bondNumber: String(n).padStart(6, "0"),
          denominationCode: d ?? null,
        });
      return out;
    });
    setChecked([
      ...nums.map((b) => ({ ...b, denominationCode: b.denominationCode ?? d ?? null })),
      ...expanded,
    ]);
    await sendCheck([
      // A number under a denomination line keeps it; others use the denomination chosen below.
      ...nums.map((b) => ({ number: b.bondNumber, denomination: b.denominationCode ?? d })),
      ...rs.map((r) => ({ from: r.from, to: r.to, denomination: d })),
    ]);
  }

  /** Sends the items (each may carry its own denomination, as rows of a spreadsheet do). */
  async function sendCheck(
    items: { number?: string; from?: string; to?: string; denomination?: string }[],
  ) {
    setFormError(null);
    setState({ kind: "checking" });
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (res.status === 429) {
        setState({ kind: "error", message: t("check.rateLimited") });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: t("check.error") });
        return;
      }
      const body = (await res.json()) as { data: CheckResponseExtra };
      setState({ kind: "done", result: body.data });
      requestAnimationFrame(() => resultsRef.current?.focus());
    } catch {
      setState({
        kind: "error",
        message:
          typeof navigator !== "undefined" && !navigator.onLine
            ? t("check.offline")
            : t("check.error"),
      });
    }
  }

  // ...are checked straight away.
  useEffect(() => {
    if (autoRun.current || !initial) return;
    autoRun.current = true;
    void runCheck(parseBondHoldings(initial).bonds, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addRange() {
    if (!/^\d{6}$/.test(from) || !/^\d{6}$/.test(to) || Number(to) < Number(from)) {
      setRangeError(t("check.rangeInvalid"));
      return;
    }
    if (Number(to) - Number(from) + 1 > MAX_CHECK_NUMBERS) {
      setRangeError(t("check.rangeTooLarge", { max: formatNumber(MAX_CHECK_NUMBERS, locale) }));
      return;
    }
    setRangeError(null);
    setRanges((r) => [...r, { from, to }]);
    setFrom("");
    setTo("");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setScan({ kind: "working", progress: 0 });
    const name = file.name.toLowerCase();
    if (name.endsWith(".txt")) {
      const written = (await file.text()).trim();
      setText((v) => (v.trim() ? `${v.trim()}\n${written}` : written));
      setScan({ kind: "done", count: parseBondHoldings(written).bonds.length });
      return;
    }
    if (/\.(csv|xlsx|xls|tsv)$/.test(name)) {
      try {
        const { sheet } = await readSheetFile(file);
        if (sheet.bonds.length === 0) {
          setScan({ kind: "error" });
          return;
        }
        if (sheet.bonds.length > MAX_CHECK_NUMBERS) {
          setScan({ kind: "idle" });
          setFormError(
            t("check.tooMany", {
              count: formatNumber(sheet.bonds.length, locale),
              max: formatNumber(MAX_CHECK_NUMBERS, locale),
            }),
          );
          return;
        }
        setScan({ kind: "done", count: sheet.bonds.length });
        setChecked(sheet.bonds);
        // One request for the whole file; each row keeps its own denomination.
        await sendCheck(
          sheet.bonds.map((b) => ({
            number: b.bondNumber,
            denomination: b.denominationCode ?? undefined,
          })),
        );
      } catch {
        setScan({ kind: "error" });
      }
      return;
    }
    try {
      const found = await numbersFromFile(file, (progress) =>
        setScan({ kind: "working", progress }),
      );
      const have = new Set(numbers.map((b) => b.bondNumber));
      const fresh = found.filter((n) => !have.has(n));
      if (fresh.length)
        setText((v) => (v.trim() ? `${v.trim()}\n${fresh.join(" ")}` : fresh.join(" ")));
      setScan({ kind: "done", count: fresh.length });
    } catch {
      setScan({ kind: "error" });
    }
  }

  const inputClass = "h-11 bg-surface font-mono";

  return (
    <div className="flex flex-col gap-6">
      <SavedAlert
        onCheck={(bonds) => {
          setText("");
          setRanges([]);
          void runCheck(bonds, []);
        }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form
          className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-4 shadow-sm"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void runCheck(numbers, ranges);
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.text} className="font-medium text-ink">
              {t("check.numbersLabel")}
            </label>
            <p id={ids.textHint} className="text-sm text-ink-2">
              {t("check.numbersHint")}
            </p>
            <Textarea
              id={ids.text}
              placeholder={"123456\n654321, 100100-100150"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${ids.textHint} ${ids.text}-count`}
              className="min-h-36 bg-surface font-mono text-base leading-relaxed"
            />
            <p id={`${ids.text}-count`} className="text-sm text-ink-2" aria-live="polite">
              {t("check.found", { count: numbers.length })}
            </p>
          </div>

          <fieldset className="flex flex-col gap-2 rounded-md border border-line p-3">
            <legend className="px-1 font-medium text-ink">{t("check.rangeTitle")}</legend>
            <p className="text-sm text-ink-2">{t("check.rangeHint")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={ids.from} className="text-sm text-ink">
                  {t("check.rangeFrom")}
                </label>
                <Input
                  id={ids.from}
                  placeholder="100100"
                  value={from}
                  onChange={(e) => setFrom(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  aria-invalid={rangeError ? true : undefined}
                  aria-describedby={rangeError ? ids.rangeErr : undefined}
                  className={`${inputClass} w-32`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={ids.to} className="text-sm text-ink">
                  {t("check.rangeTo")}
                </label>
                <Input
                  id={ids.to}
                  placeholder="100150"
                  value={to}
                  onChange={(e) => setTo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  aria-invalid={rangeError ? true : undefined}
                  aria-describedby={rangeError ? ids.rangeErr : undefined}
                  className={`${inputClass} w-32`}
                />
              </div>
              <Button variant="secondary" size="lg" onClick={addRange}>
                {t("check.rangeAdd")}
              </Button>
            </div>
            <p id={ids.rangeErr} className="text-sm text-danger" aria-live="polite">
              {rangeError}
            </p>
            {ranges.length ? (
              <ul aria-label={t("check.rangeList")} className="flex flex-wrap gap-2">
                {ranges.map((r, i) => (
                  <li
                    key={`${r.from}-${r.to}-${i}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 ps-3 text-sm"
                  >
                    <bdi dir="ltr" className="font-mono">
                      {r.from}–{r.to}
                    </bdi>
                    <button
                      type="button"
                      onClick={() => setRanges((all) => all.filter((_, j) => j !== i))}
                      aria-label={t("check.rangeRemove", { from: r.from, to: r.to })}
                      className="inline-flex size-11 items-center justify-center rounded-full hover:bg-line focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor={ids.denom} className="font-medium text-ink">
              {t("check.denominationLabel")}
            </label>
            <SelectField
              id={ids.denom}
              className="sm:w-64"
              value={denomination || "all"}
              onValueChange={(v) => setDenomination(v === "all" ? "" : v)}
              options={[
                { value: "all", label: t("check.denominationAll") },
                ...DISPLAY_ORDER.map((c: DenominationCode) => ({
                  value: c,
                  label: t(`common.denomination.${c}`),
                })),
              ]}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-dashed border-line-strong p-3">
            <p className="font-medium text-ink">{t("check.scanTitle")}</p>
            <label
              htmlFor={ids.file}
              className="inline-flex min-h-11 w-fit cursor-pointer items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus hover:bg-surface-2"
            >
              {t("check.scanButton")}
              <input
                id={ids.file}
                type="file"
                accept="image/*,.pdf,.txt,.csv,.tsv,.xlsx,.xls"
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
            <p className="text-sm text-ink-2">{t("check.scanHint")}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-ink-2">{t("check.template")}</span>
              <a
                href="/templates/bondcheck-bonds-template.csv"
                download
                className="font-medium text-brand underline underline-offset-4"
              >
                CSV
              </a>
              <a
                href="/templates/bondcheck-bonds-template.txt"
                download
                className="font-medium text-brand underline underline-offset-4"
              >
                TXT
              </a>
            </p>
            <p className="text-sm text-ink" aria-live="polite">
              {scan.kind === "working" ? t("check.scanWorking", { progress: scan.progress }) : null}
              {scan.kind === "done" ? t("check.scanDone", { count: scan.count }) : null}
              {scan.kind === "error" ? (
                <span className="text-danger">{t("check.scanError")}</span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" loading={state.kind === "checking"}>
              {state.kind === "checking"
                ? t("check.checking")
                : total
                  ? t("check.submit", { count: total })
                  : t("check.submitEmpty")}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setText("");
                setRanges([]);
                setState({ kind: "idle" });
                setFormError(null);
                setScan({ kind: "idle" });
              }}
            >
              {t("check.clear")}
            </Button>
          </div>
          <p className="text-sm text-danger" aria-live="assertive">
            {formError}
          </p>
          <p className="text-xs text-ink-2">{t("check.privacy")}</p>
        </form>

        <section aria-labelledby={ids.results} className="flex flex-col gap-3">
          <h2
            id={ids.results}
            ref={resultsRef}
            tabIndex={-1}
            className="text-lg font-semibold text-ink focus:outline-none"
          >
            {t("check.resultsTitle")}
          </h2>
          <div aria-live="polite" aria-busy={state.kind === "checking"}>
            {state.kind === "error" ? (
              <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-danger">
                {state.message}
              </p>
            ) : null}
            {state.kind === "done" ? <Results result={state.result} /> : null}
          </div>
          {state.kind === "done" && checked.length ? (
            <SaveBonds bonds={checked} fallback={denomination} />
          ) : null}
          <p className="text-xs text-ink-2">
            {t("check.coverageNote")}{" "}
            <Link href="/prize-bonds/coverage" className="underline underline-offset-4">
              {t("hub.coverageLink")}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

/** Shown when this device already has saved bonds: check them again in one tap, or open My bonds. */
function SavedAlert({ onCheck }: { onCheck: (bonds: SheetBond[]) => void }) {
  const t = useTranslations("bonds");
  const { status, snapshot } = useWallet();
  const bonds = snapshot?.bonds ?? [];
  if (status !== "ready" || bonds.length === 0) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-brand/40 bg-brand/5 p-4"
    >
      <p className="me-auto font-medium text-ink">
        {t("check.savedAlert", { count: bonds.length })}
      </p>
      <Button
        onClick={() =>
          onCheck(
            bonds.map((b) => ({
              bondNumber: b.bondNumber,
              denominationCode: b.denominationCode as DenominationCode,
              ...(b.label ? { label: b.label } : {}),
            })),
          )
        }
      >
        {t("check.checkSaved")}
      </Button>
      <Link
        href="/my/bonds"
        className="inline-flex min-h-11 items-center rounded-md px-3 font-medium text-brand underline underline-offset-4"
      >
        {t("check.openMyBonds")}
      </Link>
    </div>
  );
}

/** Saves the checked bonds to this device's wallet (made on the first save, no sign-up). */
function SaveBonds({ bonds, fallback }: { bonds: SheetBond[]; fallback: string }) {
  const t = useTranslations("bonds");
  const id = useId();
  const { addBonds, status } = useWallet();
  const [denomination, setDenomination] = useState(fallback);
  const [state, setState] = useState<
    { kind: "idle" | "saving" | "error" } | { kind: "saved"; added: number }
  >({ kind: "idle" });
  const missing = bonds.some((b) => !b.denominationCode);
  if (status === "revoked" || status === "unavailable") return null;

  async function save() {
    setState({ kind: "saving" });
    try {
      const r = await addBonds(
        bonds.map((b) => ({
          denominationCode: (b.denominationCode ?? denomination) as DenominationCode,
          bondNumber: b.bondNumber,
          ...(b.label ? { label: b.label } : {}),
        })),
      );
      setState({ kind: "saved", added: r.added });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <p className="font-semibold text-ink">{t("check.saveTitle")}</p>
      {state.kind === "saved" ? (
        <div role="status" className="flex flex-wrap items-center gap-3">
          <p className="me-auto text-success">✓ {t("check.saved", { count: state.added })}</p>
          <Link
            href="/my/bonds"
            className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 font-medium text-on-brand"
          >
            {t("check.openMyBonds")}
          </Link>
        </div>
      ) : (
        <>
          {missing ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={id} className="text-sm font-medium text-ink">
                {t("check.saveWhich")}
              </label>
              <p className="text-sm text-ink-2">{t("check.saveWhichHint")}</p>
              <SelectField
                id={id}
                className="sm:w-64"
                value={denomination}
                onValueChange={setDenomination}
                placeholder={t("check.saveWhich")}
                options={DISPLAY_ORDER.map((c: DenominationCode) => ({
                  value: c,
                  label: t(`common.denomination.${c}`),
                }))}
              />
            </div>
          ) : null}
          <Button
            size="lg"
            loading={state.kind === "saving"}
            disabled={missing && !denomination}
            onClick={() => void save()}
          >
            {state.kind === "saving"
              ? t("check.saving")
              : t("check.saveButton", { count: bonds.length })}
          </Button>
          {state.kind === "error" ? (
            <p className="text-sm text-danger">{t("check.saveError")}</p>
          ) : null}
          <p className="text-xs text-ink-2">{t("check.saveNote")}</p>
        </>
      )}
    </div>
  );
}

type Win = CheckResponseExtra["wins"][number];

function Results({ result }: { result: CheckResponseExtra }) {
  const t = useTranslations("bonds");
  const locale = useLocale();
  const columns = useMemo<GridColumn<Win>[]>(
    () => [
      {
        id: "number",
        accessorKey: "bondNumber",
        header: t("check.columns.number"),
        cell: ({ row }) => <BondNumber value={row.original.bondNumber} emphasis />,
      },
      {
        id: "bond",
        accessorKey: "denominationCode",
        header: t("check.columns.bond"),
        meta: { filter: "select", text: (v) => t(`common.denomination.${v as DenominationCode}`) },
        cell: ({ row }) => t(`common.denomination.${row.original.denominationCode}`),
      },
      {
        id: "draw",
        accessorFn: (w) => w.drawNumber ?? 0,
        header: t("check.columns.draw"),
        meta: { filter: "range" },
        cell: ({ row }) => {
          const w = row.original;
          return (
            <>
              {w.drawNumber ? (
                <Link
                  href={`/prize-bonds/${denominationSlug(w.denominationCode)}/${w.drawNumber}`}
                  className="underline underline-offset-4"
                >
                  {t("common.drawNumber", { number: w.drawNumber })}
                </Link>
              ) : (
                t("common.drawNumberUnknown")
              )}
              {w.status === "disputed" ? (
                <span className="mt-1 block text-xs text-warning">! {t("check.disputedWin")}</span>
              ) : null}
            </>
          );
        },
      },
      {
        id: "date",
        accessorKey: "drawDate",
        header: t("check.columns.date"),
        meta: { text: (v) => formatDrawDate(String(v), locale, "short") },
        cell: ({ row }) => (
          <time dateTime={row.original.drawDate} className="whitespace-nowrap">
            {formatDrawDate(row.original.drawDate, locale, "short")}
          </time>
        ),
      },
      {
        id: "prize",
        accessorKey: "tier",
        header: t("check.columns.prize"),
        meta: { filter: "select", text: (v) => t(`common.tier.${v as Win["tier"]}`) },
        cell: ({ row }) => t(`common.tier.${row.original.tier}`),
      },
      {
        id: "amount",
        accessorFn: (w) => (w.amountKnown ? w.amountPkr : 0),
        header: t("check.columns.amount"),
        meta: { numeric: true },
        cell: ({ row }) => {
          const w = row.original;
          return w.amountKnown ? (
            <bdi>{t("common.rs", { amount: formatNumber(w.amountPkr, locale) })}</bdi>
          ) : (
            t("check.amountUnknown")
          );
        },
      },
    ],
    [t, locale],
  );
  if (!result.wins.length) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-line-strong bg-surface-2 p-3 text-ink">
        <span aria-hidden="true">✗</span>
        {t("check.summaryNone", { checked: result.checked })}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 rounded-md border border-brand bg-success/10 p-3 font-medium text-success">
        <span aria-hidden="true">✓</span>
        {t("check.summaryWins", { wins: result.wins.length, checked: result.checked })}
      </p>
      <DataGrid
        columns={columns}
        data={result.wins}
        caption={t("check.winsCaption")}
        fileName="bondcheck-wins.csv"
      />
    </div>
  );
}

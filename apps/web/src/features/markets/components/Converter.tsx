"use client";

import { useId, useMemo, useState } from "react";
import { SelectField } from "@/components/ui/SelectField";
import { fill } from "./chart-math";
import { formatDate, formatNumber } from "../lib/format";

export interface ConverterLabels {
  title: string;
  amount: string;
  from: string;
  to: string;
  swap: string;
  /** "{amount} {from} = {result} {to}" */
  result: string;
  /** "1 {from} = {rate} {to}" */
  rate: string;
  /** "Reference rate of {date}. ..." */
  asOf: string;
  invalid: string;
  popular: string;
  all: string;
}

export interface ConverterProps {
  locale: string;
  /** Units per USD, from the reference rates. */
  rates: Record<string, number>;
  date: string;
  initialFrom: string;
  initialTo: string;
  popular: string[];
  /** Currency display names resolved on the server (avoids ICU differences between server and browser). */
  names: Record<string, string>;
  labels: ConverterLabels;
  /** Heading level of the title, to fit the page outline. */
  headingLevel?: 2 | 3;
}

/** Parses "1,250.5" or "1250,5"-free input; Western digits only (inputs are LTR). */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[\s,]/g, "");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 && n <= 1e15 ? n : null;
}

export function Converter({ locale, rates, date, initialFrom, initialTo, popular, names, labels, headingLevel = 2 }: ConverterProps) {
  const id = useId();
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const name = (code: string) => names[code] ?? code;
  const codes = useMemo(() => Object.keys(rates).sort(), [rates]);
  const others = codes.filter((c) => !popular.includes(c));
  const value = parseAmount(amount);
  const rate = rates[from] && rates[to] ? rates[to]! / rates[from]! : null;
  const result = value !== null && rate !== null ? value * rate : null;
  const Heading = `h${headingLevel}` as "h2" | "h3";

  const options = [
    { label: labels.popular, options: popular.filter((c) => rates[c]).map((c) => ({ value: c, label: `${c} · ${name(c)}` })) },
    { label: labels.all, options: others.map((c) => ({ value: c, label: `${c} · ${name(c)}` })) },
  ];

  const field = "min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-6">
      <Heading id={`${id}-title`} className="text-lg font-semibold text-ink">
        {labels.title}
      </Heading>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-end" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor={`${id}-amount`} className="mb-1 block text-sm font-medium text-ink-2">
            {labels.amount}
          </label>
          <input
            id={`${id}-amount`}
            dir="ltr"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={value === null || undefined}
            aria-describedby={value === null ? `${id}-err` : undefined}
            className={`${field} tabular-nums`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-from`} className="mb-1 block text-sm font-medium text-ink-2">
            {labels.from}
          </label>
          <SelectField id={`${id}-from`} value={from} onValueChange={setFrom} options={options} />
        </div>
        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line-strong bg-surface text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <span aria-hidden="true">⇄</span>
          <span className="sr-only">{labels.swap}</span>
        </button>
        <div>
          <label htmlFor={`${id}-to`} className="mb-1 block text-sm font-medium text-ink-2">
            {labels.to}
          </label>
          <SelectField id={`${id}-to`} value={to} onValueChange={setTo} options={options} />
        </div>
      </form>
      {value === null ? (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-danger">
          {labels.invalid}
        </p>
      ) : null}
      <output htmlFor={`${id}-amount ${id}-from ${id}-to`} aria-live="polite" className="mt-4 block rounded-lg bg-surface-2 p-4">
        {result !== null && value !== null && rate !== null ? (
          <>
            <span className="block text-2xl font-semibold text-ink">
              <bdi dir="ltr" className="tabular-nums">
                {fill(labels.result, { amount: formatNumber(locale, value, value % 1 ? 2 : 0), from, result: formatNumber(locale, result, result >= 1000 ? 2 : 4), to })}
              </bdi>
            </span>
            <span className="mt-1 block text-sm text-ink-2">
              <bdi dir="ltr">{fill(labels.rate, { from, rate: formatNumber(locale, rate, rate >= 100 ? 4 : 6), to })}</bdi>
            </span>
          </>
        ) : null}
      </output>
      <p className="mt-2 text-xs text-ink-2">{fill(labels.asOf, { date: formatDate(locale, date, "long") })}</p>
    </section>
  );
}

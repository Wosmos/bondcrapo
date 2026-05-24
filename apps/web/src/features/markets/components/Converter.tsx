"use client";

import { useId, useMemo, useState } from "react";
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

  const options = (
    <>
      <optgroup label={labels.popular}>
        {popular.filter((c) => rates[c]).map((c) => (
          <option key={c} value={c}>
            {c} · {name(c)}
          </option>
        ))}
      </optgroup>
      <optgroup label={labels.all}>
        {others.map((c) => (
          <option key={c} value={c}>
            {c} · {name(c)}
          </option>
        ))}
      </optgroup>
    </>
  );

  const field = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900";

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <Heading id={`${id}-title`} className="text-lg font-semibold text-slate-900">
        {labels.title}
      </Heading>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-end" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor={`${id}-amount`} className="mb-1 block text-sm font-medium text-slate-700">
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
          <label htmlFor={`${id}-from`} className="mb-1 block text-sm font-medium text-slate-700">
            {labels.from}
          </label>
          <select id={`${id}-from`} value={from} onChange={(e) => setFrom(e.target.value)} className={field}>
            {options}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <span aria-hidden="true">⇄</span>
          <span className="sr-only">{labels.swap}</span>
        </button>
        <div>
          <label htmlFor={`${id}-to`} className="mb-1 block text-sm font-medium text-slate-700">
            {labels.to}
          </label>
          <select id={`${id}-to`} value={to} onChange={(e) => setTo(e.target.value)} className={field}>
            {options}
          </select>
        </div>
      </form>
      {value === null ? (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-red-800">
          {labels.invalid}
        </p>
      ) : null}
      <output htmlFor={`${id}-amount ${id}-from ${id}-to`} aria-live="polite" className="mt-4 block rounded-lg bg-slate-50 p-4">
        {result !== null && value !== null && rate !== null ? (
          <>
            <span className="block text-2xl font-semibold text-slate-900">
              <bdi dir="ltr" className="tabular-nums">
                {fill(labels.result, { amount: formatNumber(locale, value, value % 1 ? 2 : 0), from, result: formatNumber(locale, result, result >= 1000 ? 2 : 4), to })}
              </bdi>
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              <bdi dir="ltr">{fill(labels.rate, { from, rate: formatNumber(locale, rate, rate >= 100 ? 4 : 6), to })}</bdi>
            </span>
          </>
        ) : null}
      </output>
      <p className="mt-2 text-xs text-slate-600">{fill(labels.asOf, { date: formatDate(locale, date, "long") })}</p>
    </section>
  );
}

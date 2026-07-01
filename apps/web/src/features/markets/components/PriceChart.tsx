"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { downsample, fill, linePath, summarize, tableRows, yScale, type ChartPoint } from "./chart-math";
import { formatDate, formatMoney, formatNumber, formatPercent } from "../lib/format";
import { RangePicker, type CustomWindow, type RangePickerLabels } from "./RangePicker";

export type ChartRange = "1m" | "6m" | "1y" | "5y" | "max";

export type ChartSource =
  | { kind: "metal"; metal: string; currency: string; /** multiply the per ounce close (e.g. to per tola, 24K) */ scale: number }
  | { kind: "fx"; base: string; quote: string };

export interface ChartLabels {
  rangeGroup: string;
  ranges: Record<ChartRange, string>;
  /** e.g. "Price on {date}" for the slider */
  slider: string;
  keyboardHint: string;
  loading: string;
  error: string;
  retry: string;
  empty: string;
  showTable: string;
  tableCaption: string;
  tableSampled: string;
  date: string;
  value: string;
  /** "{subject} {trend} {change} from {start} on {startDate} to {end} on {endDate}. High {high} on {highDate}, low {low} on {lowDate}." */
  summary: string;
  trendUp: string;
  trendDown: string;
  trendFlat: string;
  /** Strings for the custom date range picker. */
  custom: RangePickerLabels;
}

export interface PriceChartProps {
  locale: string;
  /** What the series is, used in the summary ("Gold, 24K per tola"). */
  subject: string;
  /** ISO currency for formatting, or null for a plain rate. */
  currency: string | null;
  decimals?: number;
  tone?: "gold" | "silver" | "platinum" | "currency";
  ranges: ChartRange[];
  initialRange: ChartRange;
  initialPoints: ChartPoint[];
  source: ChartSource;
  labels: ChartLabels;
}

const TONES = {
  // Theme tokens, so the chart follows light and dark mode (styles/globals.css).
  gold: { stroke: "var(--gold-ink)", fill: "var(--gold)" },
  silver: { stroke: "var(--ink-2)", fill: "var(--line-strong)" },
  platinum: { stroke: "var(--brand)", fill: "var(--brand)" },
  currency: { stroke: "var(--info)", fill: "var(--info)" },
} as const;

const MAX_DRAWN = 320;

/** A preset range, or `custom` with its own window. */
type Selection = ChartRange | "custom";

function endpoint(source: ChartSource, range: ChartRange, window?: CustomWindow): string {
  const span = window ? `&from=${window.from}&to=${window.to}` : "";
  if (source.kind === "metal") {
    return `/api/v1/markets/metals/history?metal=${source.metal}&currency=${source.currency}&range=${range}${span}`;
  }
  return `/api/v1/markets/fx/history?base=${source.base}&quote=${source.quote}&range=${range}${span}`;
}

const seriesKey = (sel: Selection, window: CustomWindow | null) => (sel === "custom" && window ? `custom:${window.from}:${window.to}` : sel);

function toPoints(source: ChartSource, json: unknown): ChartPoint[] {
  const data = (json as { data?: { points?: unknown[] } })?.data?.points;
  if (!Array.isArray(data)) throw new Error("bad response");
  return data.flatMap((p) => {
    const r = p as { date?: string; close?: number; rate?: number };
    const v = source.kind === "metal" ? (r.close ?? NaN) * source.scale : (r.rate ?? NaN);
    return typeof r.date === "string" && Number.isFinite(v) ? [{ date: r.date, value: v }] : [];
  });
}

/**
 * Lightweight, dependency free line chart. The plot is an SVG stretched to its box; text is HTML
 * so it stays crisp at any width. Keyboard users move through points with the arrow keys (the
 * plot is a slider), a visible text summary and a data table give the same information without
 * the graphic (WCAG 1.1.1, 1.4.1, 2.1.1).
 */
export function PriceChart(props: PriceChartProps) {
  const { locale, labels, source, currency, tone = "gold" } = props;
  const [range, setRange] = useState<Selection>(props.initialRange);
  const [custom, setCustom] = useState<CustomWindow | null>(null);
  const [series, setSeries] = useState<Record<string, ChartPoint[]>>({ [props.initialRange]: props.initialPoints });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [active, setActive] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const id = useId();
  const colors = TONES[tone];

  const key = seriesKey(range, custom);
  const points = useMemo(() => series[key] ?? [], [series, key]);
  const drawn = useMemo(() => downsample(points, MAX_DRAWN), [points]);
  const scale = useMemo(() => yScale(drawn.map((p) => p.value)), [drawn]);
  const path = useMemo(() => linePath(drawn, scale.min, scale.max), [drawn, scale]);
  const summary = useMemo(() => summarize(points), [points]);

  const fmt = useCallback(
    (v: number) => (currency ? formatMoney(locale, currency, v, props.decimals) : formatNumber(locale, v, props.decimals ?? 4)),
    [currency, locale, props.decimals],
  );

  const load = useCallback(
    async (next: Selection, window: CustomWindow | null) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStatus("loading");
      try {
        const res = await fetch(endpoint(source, next === "custom" ? "max" : next, next === "custom" ? (window ?? undefined) : undefined), { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        const pts = toPoints(source, await res.json());
        setSeries((s) => ({ ...s, [seriesKey(next, window)]: pts }));
        setStatus("idle");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    },
    [source],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const choose = (next: Selection, window: CustomWindow | null = custom) => {
    setRange(next);
    setActive(null);
    if (next === "custom") setCustom(window);
    if (!series[seriesKey(next, window)]) void load(next, window);
    else setStatus("idle");
  };

  const n = drawn.length;
  const pointAt = (i: number) => drawn[Math.max(0, Math.min(n - 1, i))]!;
  const xPct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yPct = (v: number) => 100 - ((v - scale.min) / (scale.max - scale.min)) * 100;

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || n === 0) return;
    const ratio = (e.clientX - box.left) / box.width;
    setActive(Math.round(Math.max(0, Math.min(1, ratio)) * (n - 1)));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const cur = active ?? n - 1;
    const page = Math.max(1, Math.round(n / 10));
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? cur - 1
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? cur + 1
          : e.key === "PageDown"
            ? cur - page
            : e.key === "PageUp"
              ? cur + page
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? n - 1
                  : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(n - 1, next)));
  };

  const shown = active === null ? null : pointAt(active);
  const valueText = shown ? `${formatDate(locale, shown.date, "long")}: ${fmt(shown.value)}` : summary ? `${formatDate(locale, summary.end.date, "long")}: ${fmt(summary.end.value)}` : labels.empty;

  const summaryText = summary
    ? fill(labels.summary, {
        subject: props.subject,
        trend: summary.changePct > 0.005 ? labels.trendUp : summary.changePct < -0.005 ? labels.trendDown : labels.trendFlat,
        change: formatPercent(locale, summary.changePct),
        start: fmt(summary.start.value),
        startDate: formatDate(locale, summary.start.date),
        end: fmt(summary.end.value),
        endDate: formatDate(locale, summary.end.date),
        high: fmt(summary.high.value),
        highDate: formatDate(locale, summary.high.date),
        low: fmt(summary.low.value),
        lowDate: formatDate(locale, summary.low.date),
      })
    : null;

  const table = tableRows(points);
  const xTicks = n > 1 ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (n - 1))) : [];

  return (
    <figure className="m-0" aria-labelledby={summaryText ? `${id}-summary` : undefined}>
      <div role="group" aria-label={labels.rangeGroup} className="mb-3 flex flex-wrap gap-1.5">
        {props.ranges.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={r === range}
            onClick={() => choose(r)}
            className={`min-h-9 min-w-11 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              r === range ? "bg-brand text-on-brand" : "bg-surface-2 text-ink-2 hover:bg-line"
            }`}
          >
            {labels.ranges[r]}
          </button>
        ))}
        <RangePicker
          locale={locale}
          pressed={range === "custom"}
          value={custom}
          labels={labels.custom}
          formatDate={(d) => formatDate(locale, d)}
          onApply={(w) => choose("custom", w)}
        />
      </div>

      <div dir="ltr" className="relative grid grid-cols-[3.75rem_1fr] grid-rows-[1fr_1.75rem] gap-x-2">
        {/* y axis */}
        <div className="relative h-56 sm:h-72" aria-hidden="true">
          {n > 1 &&
            scale.ticks.map((t) => (
              <span
                key={t}
                className="absolute end-0 -translate-y-1/2 text-[11px] tabular-nums text-ink-2"
                style={{ top: `${yPct(t)}%` }}
              >
                {formatNumber(locale, t, Math.abs(scale.max) < 10 ? 2 : 0)}
              </span>
            ))}
        </div>

        {/* plot */}
        <div
          ref={plotRef}
          role="slider"
          tabIndex={n > 0 ? 0 : -1}
          aria-label={fill(labels.slider, { subject: props.subject })}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, n - 1)}
          aria-valuenow={active ?? Math.max(0, n - 1)}
          aria-valuetext={valueText}
          aria-describedby={`${id}-hint`}
          aria-busy={status === "loading" || undefined}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          className={`relative h-56 touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:h-72 ${
            status === "loading" ? "opacity-50" : ""
          } motion-safe:transition-opacity`}
        >
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: colors.fill }} stopOpacity="0.28" />
                <stop offset="100%" style={{ stopColor: colors.fill }} stopOpacity="0" />
              </linearGradient>
            </defs>
            {n > 1 &&
              scale.ticks.map((t) => {
                const y = (yPct(t) / 100) * 300;
                return <line key={t} x1="0" x2="1000" y1={y} y2={y} style={{ stroke: "var(--line)" }} strokeWidth="1" vectorEffect="non-scaling-stroke" />;
              })}
            {n > 1 && (
              <>
                <path d={`${path}L1000,300L0,300Z`} fill={`url(#${id}-fill)`} />
                <path d={path} fill="none" style={{ stroke: colors.stroke }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>

          {shown && active !== null && (
            <>
              <div className="pointer-events-none absolute inset-y-0 w-px bg-line-strong" style={{ left: `${xPct(active)}%` }} aria-hidden="true" />
              <div
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow"
                style={{ left: `${xPct(active)}%`, top: `${yPct(shown.value)}%`, background: colors.stroke }}
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute top-1 z-10 rounded-md bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lg"
                style={xPct(active) > 60 ? { right: `${100 - xPct(active) + 1.5}%` } : { left: `${xPct(active) + 1.5}%` }}
                aria-hidden="true"
              >
                <div className="font-semibold tabular-nums">{fmt(shown.value)}</div>
                <div className="text-ink-2">{formatDate(locale, shown.date)}</div>
              </div>
            </>
          )}

          {n <= 1 && status !== "loading" && (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ink-2">
              {status === "error" ? labels.error : labels.empty}
            </p>
          )}
        </div>

        {/* x axis */}
        <span aria-hidden="true" />
        <div className="relative" aria-hidden="true">
          {xTicks.map((i, k) => (
            <span
              key={`${i}-${k}`}
              className={`absolute top-1.5 whitespace-nowrap text-[11px] text-ink-2 ${k === 0 ? "" : k === xTicks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${xPct(i)}%` }}
            >
              {formatDate(locale, drawn[i]!.date, points.length > 400 ? "medium" : "short")}
            </span>
          ))}
        </div>
      </div>

      <p id={`${id}-hint`} className="sr-only">
        {labels.keyboardHint}
      </p>
      <div aria-live="polite" className="sr-only">
        {status === "loading" ? labels.loading : status === "error" ? labels.error : ""}
      </div>
      {status === "error" && (
        <p className="mt-2 text-sm text-danger">
          {labels.error}{" "}
          <button type="button" onClick={() => void load(range, custom)} className="font-semibold underline underline-offset-2">
            {labels.retry}
          </button>
        </p>
      )}

      {summaryText && (
        <figcaption id={`${id}-summary`} className="mt-3 text-sm leading-relaxed text-ink-2">
          {summaryText}
        </figcaption>
      )}

      {points.length > 0 && (
        <details className="group mt-3 rounded-lg border border-line bg-surface-2/60">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            {labels.showTable}
          </summary>
          <div className="max-h-80 overflow-y-auto px-3 pb-3">
            <table className="w-full border-collapse text-sm" data-testid="chart-table">
              <caption className="py-2 text-start text-xs text-ink-2">
                {labels.tableCaption}
                {table.step > 1 ? ` ${fill(labels.tableSampled, { step: String(table.step) })}` : ""}
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-1.5 text-start font-semibold text-ink-2">
                    {labels.date}
                  </th>
                  <th scope="col" className="py-1.5 text-end font-semibold text-ink-2">
                    {labels.value}
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((p) => (
                  <tr key={p.date} className="border-b border-line last:border-0">
                    <td className="py-1.5 text-ink-2">{formatDate(locale, p.date)}</td>
                    <td className="py-1.5 text-end tabular-nums text-ink">
                      <bdi dir="ltr">{fmt(p.value)}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}

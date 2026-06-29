import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../../../messages/en/markets.json";
import ur from "../../../../messages/ur/markets.json";
import { downsample, fill, linePath, summarize, tableRows, yScale, type ChartPoint } from "./chart-math";
import { PriceChart, type ChartLabels } from "./PriceChart";

const series = (n: number, f: (i: number) => number = (i) => 100 + i): ChartPoint[] =>
  Array.from({ length: n }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10), value: f(i) }));

const labels: ChartLabels = {
  ...en.chart,
  ranges: en.chart.ranges,
};

describe("chart math", () => {
  it("downsamples while keeping the extremes and both ends", () => {
    const pts = series(1000, (i) => (i === 500 ? 9999 : i === 700 ? -5 : 100));
    const d = downsample(pts, 100);
    expect(d.length).toBeLessThanOrEqual(100);
    expect(d[0]).toBe(pts[0]);
    expect(d.at(-1)).toBe(pts.at(-1));
    expect(d.some((p) => p.value === 9999)).toBe(true);
    expect(d.some((p) => p.value === -5)).toBe(true);
    expect(downsample(series(10), 100)).toHaveLength(10);
  });

  it("chooses round ticks that cover the data", () => {
    const s = yScale([437_100, 441_900]);
    expect(s.min).toBeLessThanOrEqual(437_100);
    expect(s.max).toBeGreaterThanOrEqual(441_900);
    expect(s.ticks.length).toBeGreaterThanOrEqual(3);
    expect(s.ticks.every((t) => t % 1000 === 0)).toBe(true);
    expect(yScale([5, 5]).max).toBeGreaterThan(5);
  });

  it("summarises change, high and low", () => {
    const s = summarize([
      { date: "2026-10-01", value: 100 },
      { date: "2026-10-02", value: 120 },
      { date: "2026-10-03", value: 90 },
      { date: "2026-10-04", value: 110 },
    ])!;
    expect(s.changePct).toBeCloseTo(10, 6);
    expect(s.high.date).toBe("2026-10-02");
    expect(s.low.date).toBe("2026-10-03");
    expect(summarize([{ date: "2026-10-01", value: 1 }])).toBeNull();
  });

  it("limits the table to about 60 rows, newest first", () => {
    const { rows, step } = tableRows(series(365));
    expect(rows.length).toBeLessThanOrEqual(62);
    expect(step).toBe(6);
    expect(rows[0]!.date).toBe(series(365).at(-1)!.date);
    expect(tableRows(series(10)).rows).toHaveLength(10);
  });

  it("draws inside the view box", () => {
    expect(linePath(series(3), 100, 102)).toBe("M0.00,300.00L500.00,150.00L1000.00,0.00");
    expect(fill("{a} and {b}", { a: "x" })).toBe("x and {b}");
  });
});

describe("PriceChart", () => {
  const props = {
    locale: "en",
    subject: "Gold, 24K per tola",
    currency: "PKR",
    decimals: 0,
    ranges: ["1m", "6m"] as const,
    initialRange: "1m" as const,
    initialPoints: series(30, (i) => 430_000 + i * 300),
    source: { kind: "metal" as const, metal: "XAU", currency: "PKR", scale: 0.375 },
    labels,
  };

  it("server renders the plot, a keyboard slider, a text summary and an accessible data table", () => {
    const html = renderToString(createElement(PriceChart, { ...props, ranges: [...props.ranges] }));
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuetext="30 January 2026: Rs');
    expect(html).toContain("<figcaption");
    expect(html).toMatch(/Gold, 24K per tola rose \+2\.02% over this period/);
    expect(html).toContain('data-testid="chart-table"');
    expect(html).toContain("<caption");
    expect(html).toMatch(/<th scope="col"[^>]*>Date<\/th>/);
    // 30 rows in the alternative table, one per day
    expect(html.match(/<tr class="border-b border-line last:border-0/g)).toHaveLength(30);
    expect(html).toContain('aria-pressed="true"');
  });

  it("shows an empty state without points and no table", () => {
    const html = renderToString(createElement(PriceChart, { ...props, ranges: [...props.ranges], initialPoints: [] }));
    expect(html).toContain(en.chart.empty);
    expect(html).not.toContain('data-testid="chart-table"');
  });
});

describe("markets messages", () => {
  const keys = (o: unknown, pre = ""): string[] =>
    o && typeof o === "object" && !Array.isArray(o)
      ? Object.entries(o).flatMap(([k, v]) => keys(v, `${pre}${k}.`))
      : [`${pre}${Array.isArray(o) ? `[${o.length}]` : ""}`];

  it("Urdu has exactly the English keys, and no em dashes anywhere", () => {
    expect(keys(ur).sort()).toEqual(keys(en).sort());
    expect(JSON.stringify(en) + JSON.stringify(ur)).not.toContain(String.fromCharCode(0x2014));
  });

  it("keeps placeholders identical across locales", () => {
    const flat = (o: unknown, pre = ""): [string, string][] =>
      typeof o === "string" ? [[pre, o]] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => flat(v, `${pre}.${k}`)) : [];
    const urMap = new Map(flat(ur));
    for (const [k, v] of flat(en)) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(urMap.get(k) ?? ""), k).toBe(ph(v));
    }
  });
});

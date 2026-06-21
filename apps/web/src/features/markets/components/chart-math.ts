/** Pure helpers behind PriceChart (unit tested; no React). */
export interface ChartPoint {
  date: string;
  value: number;
}

/** Keeps the first, last, and per bucket minimum and maximum, so peaks survive downsampling. */
export function downsample(points: ChartPoint[], maxPoints: number): ChartPoint[] {
  if (points.length <= maxPoints || maxPoints < 4) return points;
  const buckets = Math.floor((maxPoints - 2) / 2);
  const inner = points.slice(1, -1);
  const size = inner.length / buckets;
  const out: ChartPoint[] = [points[0]!];
  for (let b = 0; b < buckets; b++) {
    const slice = inner.slice(Math.floor(b * size), Math.floor((b + 1) * size));
    if (slice.length === 0) continue;
    let lo = slice[0]!;
    let hi = slice[0]!;
    for (const p of slice) {
      if (p.value < lo.value) lo = p;
      if (p.value > hi.value) hi = p;
    }
    const pair = lo.date <= hi.date ? [lo, hi] : [hi, lo];
    for (const p of pair) if (out[out.length - 1] !== p) out.push(p);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** Rows for the accessible data table: at most `max`, always including the newest point. */
export function tableRows(points: ChartPoint[], max = 62): { rows: ChartPoint[]; step: number } {
  if (points.length <= max) return { rows: [...points].reverse(), step: 1 };
  const step = Math.ceil(points.length / max);
  const rows: ChartPoint[] = [];
  for (let i = points.length - 1; i >= 0; i -= step) rows.push(points[i]!);
  return { rows, step };
}

function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = raw / 10 ** exp;
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 2.5 ? 2.5 : base <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

/** Y domain padded to round ticks (about four gridlines). */
export function yScale(values: number[]): { min: number; max: number; ticks: number[] } {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, ticks: [0, 1] };
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.01 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep((hi - lo) / 4);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { min, max, ticks };
}

export interface Summary {
  start: ChartPoint;
  end: ChartPoint;
  high: ChartPoint;
  low: ChartPoint;
  changePct: number;
}

export function summarize(points: ChartPoint[]): Summary | null {
  if (points.length < 2) return null;
  let high = points[0]!;
  let low = points[0]!;
  for (const p of points) {
    if (p.value > high.value) high = p;
    if (p.value < low.value) low = p;
  }
  const start = points[0]!;
  const end = points[points.length - 1]!;
  return { start, end, high, low, changePct: (end.value / start.value - 1) * 100 };
}

/** SVG path for points in a 0..1000 x 0..300 box (the SVG stretches to its container). */
export function linePath(points: ChartPoint[], min: number, max: number, width = 1000, height = 300): string {
  if (points.length === 0) return "";
  const n = points.length;
  return points
    .map((p, i) => {
      const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
      const y = height - ((p.value - min) / (max - min)) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join("");
}

/** Replaces `{name}` placeholders. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

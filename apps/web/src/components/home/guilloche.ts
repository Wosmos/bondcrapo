/**
 * Banknote style guilloche rosettes, computed once at module load on the server and inlined as
 * SVG paths (no image request, themable with CSS variables, about 3 KB gzipped).
 */

const f = (n: number) => n.toFixed(1);

/** Hypotrochoid with integer radii so the curve closes after `r / gcd(R, r)` turns. */
export function hypotrochoid(R: number, r: number, d: number, cx: number, cy: number, perTurn = 96): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const turns = r / gcd(R, r);
  const steps = turns * perTurn;
  const k = (R - r) / r;
  let out = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * 2 * Math.PI;
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(k * t);
    out += `${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`;
  }
  return `${out}Z`;
}

export const ROSETTE = {
  outer: hypotrochoid(60, 22, 46, 100, 100),
  inner: hypotrochoid(45, 16, 30, 100, 100),
  core: hypotrochoid(25, 9, 15, 100, 100, 72),
};

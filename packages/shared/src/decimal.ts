/**
 * Minimal fixed point helper for Postgres `numeric` values that Drizzle returns as strings
 * (`numeric(20,8)` market prices). Avoids binary float drift in storage round trips.
 */
const SCALE_DIGITS = 12;
const SCALE = 10n ** BigInt(SCALE_DIGITS);

export function decimalToScaled(value: string): bigint {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) throw new SyntaxError(`invalid decimal: ${value}`);
  const frac = (m[3] ?? "").padEnd(SCALE_DIGITS, "0").slice(0, SCALE_DIGITS);
  const scaled = BigInt(m[2]!) * SCALE + BigInt(frac || "0");
  return m[1] === "-" ? -scaled : scaled;
}

export function scaledToDecimal(value: bigint, places = 8): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(SCALE_DIGITS, "0").slice(0, places);
  return `${neg ? "-" : ""}${whole}${places > 0 ? `.${frac}` : ""}`;
}

export function decimalToNumber(value: string): number {
  return Number(value);
}

export function mulDecimal(a: string, b: string, places = 8): string {
  return scaledToDecimal((decimalToScaled(a) * decimalToScaled(b)) / SCALE, places);
}

export function divDecimal(a: string, b: string, places = 8): string {
  const denom = decimalToScaled(b);
  if (denom === 0n) throw new RangeError("division by zero");
  return scaledToDecimal((decimalToScaled(a) * SCALE) / denom, places);
}

/** Localised currency names, computed on the server. */
export function currencyNames(locale: string, codes: Iterable<string>): Record<string, string> {
  const out: Record<string, string> = {};
  let dn: Intl.DisplayNames | undefined;
  try {
    dn = new Intl.DisplayNames([locale === "ur" ? "ur" : "en"], { type: "currency" });
  } catch {
    dn = undefined;
  }
  for (const c of codes) out[c] = dn?.of(c) ?? c;
  return out;
}

import { DENOMINATIONS, type DenominationInfo } from "@bondcheck/shared";
import { groupDigits } from "./format";
import type { TFunction } from "@/i18n/translate";

export const ACTIVE_DENOMINATIONS = DENOMINATIONS.filter((d) => d.active);

export function findDenomination(code: string): DenominationInfo | undefined {
  return DENOMINATIONS.find((d) => d.code === code);
}

/** "Rs 750" or "Rs 40,000 Premium" (translated). */
export function denominationLabel(code: string, t: TFunction): string {
  const info = findDenomination(code);
  if (!info) return code;
  const value = groupDigits(info.faceValue);
  return info.kind === "premium_registered"
    ? t("denomination.premium", { value })
    : t("denomination.bearer", { value });
}

export function faceValueOf(code: string): number {
  return findDenomination(code)?.faceValue ?? 0;
}

import { formatBondNumber } from "@bondcheck/shared";

export interface BondNumberProps {
  value: number | string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Visually emphasised (e.g. a match). Never conveyed by colour alone. */
  emphasis?: boolean;
}

const SIZE = { sm: "text-sm", md: "text-base", lg: "text-xl", xl: "text-3xl sm:text-4xl" } as const;

/** Six digits with Western numerals, isolated left to right inside Urdu text (PLAN section 8). */
export function BondNumber({ value, size = "md", emphasis = false }: BondNumberProps) {
  return (
    <bdi dir="ltr" className={`font-mono tabular-nums tracking-wider ${SIZE[size]} ${emphasis ? "font-bold" : ""}`}>
      {formatBondNumber(value)}
    </bdi>
  );
}

import type { ReactNode } from "react";

export interface BadgeProps {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
}

// Tinted fill plus a hairline in the tone colour; the text itself carries the meaning.
const TONE: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-surface-2 text-ink-2 ring-line-strong/40",
  success: "bg-success/14 text-success ring-success/35",
  warning: "bg-warning/14 text-warning ring-warning/35",
  danger: "bg-danger/14 text-danger ring-danger/35",
  info: "bg-info/14 text-info ring-info/35",
};

/** Always carries text; never rely on the tone colour alone. */
export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

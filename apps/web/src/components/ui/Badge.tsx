import type { ReactNode } from "react";
import { Badge as ShadcnBadge } from "@/components/shadcn/badge";
import { cn } from "@/lib/utils";

export interface BadgeProps {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
}

// shadcn's outline badge with a tinted fill in the tone colour; the text itself carries the meaning.
const TONE: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line-strong/40",
  success: "bg-success/14 text-success border-success/35",
  warning: "bg-warning/14 text-warning border-warning/35",
  danger: "bg-danger/14 text-danger border-danger/35",
  info: "bg-info/14 text-info border-info/35",
};

/** Always carries text; never rely on the tone colour alone. */
export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <ShadcnBadge variant="outline" className={cn("px-2.5 font-semibold", TONE[tone])}>
      {children}
    </ShadcnBadge>
  );
}

import type { ReactNode } from "react";

export interface StatProps {
  label: ReactNode;
  /** Pre-formatted value (use `Intl` and wrap bond numbers in `<bdi dir="ltr">`). */
  value: ReactNode;
  /** Direction is conveyed by text and icon, never by colour alone. */
  change?: { text: string; direction: "up" | "down" | "flat" };
  hint?: ReactNode;
}

const ARROW = { up: "▲", down: "▼", flat: "◆" } as const;
const TONE = { up: "text-success", down: "text-danger", flat: "text-ink-2" } as const;

export function Stat({ label, value, change, hint }: StatProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <dl>
        <dt className="text-sm text-ink-2">{label}</dt>
        <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</dd>
      </dl>
      {change ? (
        <p className={`mt-1 text-sm font-medium ${TONE[change.direction]}`}>
          <span aria-hidden="true">{ARROW[change.direction]} </span>
          {change.text}
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

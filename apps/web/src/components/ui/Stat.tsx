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

export function Stat({ label, value, change, hint }: StatProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dl>
        <dt className="text-sm text-slate-600">{label}</dt>
        <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</dd>
      </dl>
      {change ? (
        <p className="mt-1 text-sm text-slate-700">
          <span aria-hidden="true">{ARROW[change.direction]} </span>
          {change.text}
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

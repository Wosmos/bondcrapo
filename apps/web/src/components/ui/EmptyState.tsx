import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Typically a Button or Link. */
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong/60 bg-surface/60 px-6 py-10 text-center">
      <svg aria-hidden="true" viewBox="0 0 48 48" className="mb-1 size-10 text-gold">
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" />
        <path d="M17 24h14M24 17v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="text-base font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-prose text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

import { TrayIcon } from "@/components/ui/icons";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Typically a Button or Link. */
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong/60 bg-surface/60 px-6 py-10 text-center">
      <TrayIcon aria-hidden="true" className="mb-1 size-10 text-ink-2" />
      <p className="text-base font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-prose text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

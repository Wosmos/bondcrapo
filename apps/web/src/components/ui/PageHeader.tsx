import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** The page's single h1. */
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or links aligned to the end. */
  actions?: ReactNode;
}

/** The page title block. Its bottom margin is dropped inside flex or grid parents, whose gap already spaces it. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6 [.flex>&]:mb-0 [.grid>&]:mb-0">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink text-balance sm:text-4xl">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-prose text-ink-2 text-pretty">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

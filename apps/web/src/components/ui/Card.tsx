import type { ReactNode } from "react";

export interface CardProps {
  /** Optional heading rendered at `headingLevel`. */
  title?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** Content aligned to the end of the header (actions, badges). */
  actions?: ReactNode;
  children: ReactNode;
}

export function Card({ title, headingLevel = 2, actions, children }: CardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <Heading className="text-base font-semibold text-ink">{title}</Heading> : <span />}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

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
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title ? <Heading className="text-base font-semibold text-slate-900">{title}</Heading> : <span />}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

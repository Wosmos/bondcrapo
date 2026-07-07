import type { ReactNode } from "react";
import { Card as ShadcnCard, CardAction, CardContent, CardHeader } from "@/components/shadcn/card";

export interface CardProps {
  /** Optional heading rendered at `headingLevel`. */
  title?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** Content aligned to the end of the header (actions, badges). */
  actions?: ReactNode;
  children: ReactNode;
}

/** The app's card: shadcn/ui Card with a real heading element for the title. */
export function Card({ title, headingLevel = 2, actions, children }: CardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <ShadcnCard className="gap-4 py-5">
      {title || actions ? (
        <CardHeader className="items-center px-5">
          {title ? (
            <Heading data-slot="card-title" className="text-base leading-snug font-semibold text-ink">
              {title}
            </Heading>
          ) : (
            <span />
          )}
          {actions ? <CardAction className="self-center">{actions}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className="px-5">{children}</CardContent>
    </ShadcnCard>
  );
}

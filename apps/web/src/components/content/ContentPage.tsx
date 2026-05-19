import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

/** Frame for text pages (About, Data, Privacy, Terms): one h1, readable measure, quiet aside. */
export function ContentPage({
  title,
  lead,
  meta,
  children,
}: {
  title: string;
  lead: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 md:pt-14">
      <PageHeader title={title} description={lead} actions={meta} />
      <div className="prose-bc text-ink">{children}</div>
    </div>
  );
}

export interface Section {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export function Sections({ sections }: { sections: Section[] }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.heading} aria-label={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
          {s.items ? (
            <ul>
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </>
  );
}

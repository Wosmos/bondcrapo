import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { attributionFor } from "@bondcheck/ingest/markets/sources";
import { formatDateTime, isOlderThanDays } from "../lib/format";

/** Small server components shared by the market pages. */

export function JsonLd({ data }: { data: unknown }) {
  // `<` is escaped so a value can never close the script element.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** "Reported" vs "Estimated": text always, colour only as a second cue. */
export function KindBadge({ kind, labels }: { kind: "reported" | "derived"; labels: { reported: string; estimated: string } }) {
  return <Badge tone={kind === "reported" ? "success" : "info"}>{kind === "reported" ? labels.reported : labels.estimated}</Badge>;
}

export function Price({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={`tabular-nums ${className}`}>
      {children}
    </bdi>
  );
}

export function Change({ pct, text, labels }: { pct: number | null; text: string; labels: { up: string; down: string; unchanged: string } }) {
  if (pct === null) return null;
  const dir = Math.abs(pct) < 0.005 ? "flat" : pct > 0 ? "up" : "down";
  const icon = dir === "up" ? "▲" : dir === "down" ? "▼" : "◆";
  const tone = dir === "up" ? "text-success" : dir === "down" ? "text-danger" : "text-ink-2";
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${tone}`}>
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{dir === "up" ? labels.up : dir === "down" ? labels.down : labels.unchanged}: </span>
      <bdi dir="ltr">{text}</bdi>
    </span>
  );
}

export function Updated({ iso, locale, label, staleLabel }: { iso: string; locale: string; label: string; staleLabel: string }) {
  const stale = isOlderThanDays(iso, 2);
  return (
    <p className="text-xs text-ink-2">
      <time dateTime={iso}>{label.replace("{time}", formatDateTime(locale, iso))}</time>
      {stale ? <span className="mt-1 block font-medium text-warning">{staleLabel}</span> : null}
    </p>
  );
}

export interface SubnavLabels {
  label: string;
  gold: string;
  silver: string;
  metals: string;
  currency: string;
}

export function MarketsSubnav({ current, labels }: { current: "gold" | "silver" | "metals" | "currency"; labels: SubnavLabels }) {
  const items = [
    { id: "gold", href: "/gold-rate", label: labels.gold },
    { id: "silver", href: "/silver-rate", label: labels.silver },
    { id: "metals", href: "/metals/platinum", label: labels.metals },
    { id: "currency", href: "/currency", label: labels.currency },
  ] as const;
  return (
    <nav aria-label={labels.label} className="-mx-1 mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-1">
        {items.map((i) => (
          <li key={i.id}>
            <Link
              href={i.href}
              aria-current={i.id === current ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                i.id === current ? "bg-brand text-on-brand" : "bg-surface text-ink-2 ring-1 ring-line hover:bg-surface-2"
              }`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Breadcrumbs({ items, label }: { items: { name: string; href?: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-3 text-sm text-ink-2">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={`${c.name}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {c.href ? (
              <Link href={c.href} className="underline-offset-2 hover:underline">
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SampleNotice({ text }: { text: string }) {
  return (
    <p role="note" className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
      {text}
    </p>
  );
}

export function Unavailable({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm text-ink-2">{description}</p>
    </div>
  );
}

export function Sources({ ids, title, note }: { ids: string[]; title: string; note?: ReactNode }) {
  const list = attributionFor(ids);
  if (list.length === 0 && !note) return null;
  return (
    <section aria-labelledby="markets-sources" className="mt-10 border-t border-line pt-6 text-sm text-ink-2">
      <h2 id="markets-sources" className="text-base font-semibold text-ink">
        {title}
      </h2>
      {note ? <div className="mt-2 max-w-prose leading-relaxed">{note}</div> : null}
      <ul className="mt-3 space-y-1.5">
        {list.map((a) => (
          <li key={a.text}>
            {a.url ? (
              <a href={a.url} rel="noopener noreferrer external" target="_blank" className="font-medium text-ink underline underline-offset-2">
                {a.name}
              </a>
            ) : (
              <span className="font-medium text-ink">{a.name}</span>
            )}
            : {a.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Faq({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  return (
    <section aria-labelledby="markets-faq" className="mt-10">
      <h2 id="markets-faq" className="mb-3 text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {items.map((f) => (
          <details key={f.q} className="group px-4 py-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
              {f.q}
              <span aria-hidden="true" className="text-ink-2 transition-transform group-open:rotate-45 motion-reduce:transition-none">
                +
              </span>
            </summary>
            <p className="pb-3 text-sm leading-relaxed text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export const surface = "rounded-xl border border-line bg-surface shadow-sm";

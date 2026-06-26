import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface Crumb {
  href?: string;
  label: string;
}

/** Breadcrumb trail; the last item is the current page. Separators flip in RTL. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useTranslations("bonds.common");
  return (
    <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-ink-2">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 ? (
              <span aria-hidden="true" className="text-ink-2 rtl:rotate-180">
                ›
              </span>
            ) : null}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className="font-medium text-ink">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

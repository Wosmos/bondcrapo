import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui";

/** Shown when the data source cannot be reached. The page itself still renders. */
export function Unavailable({ retryHref }: { retryHref: string }) {
  const t = useTranslations("bonds.common");
  return (
    <div role="status">
      <EmptyState
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        action={
          <a
            href={retryHref}
            className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {t("retry")}
          </a>
        }
      />
    </div>
  );
}

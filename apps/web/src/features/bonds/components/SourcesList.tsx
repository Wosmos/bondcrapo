import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import { formatDrawDate } from "../format";
import type { DrawPageView } from "../server/pages";

const TONE = { primary: "success", corroborating: "neutral", conflicting: "warning" } as const;

/** Provenance: every document behind the draw, its role, fetch date and content hash. */
export function SourcesList({ sources }: { sources: DrawPageView["sources"] }) {
  const t = useTranslations("bonds.draw");
  const locale = useLocale();
  return (
    <section aria-labelledby="sources">
      <h2 id="sources" className="text-lg font-semibold text-slate-900">
        {t("sourcesTitle")}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t("sourcesIntro")}</p>
      <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {sources.map((s) => {
          const external = /^https?:\/\//.test(s.url);
          return (
            <li key={s.sha256} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {external ? (
                    <a href={s.url.split("#")[0]} rel="noopener noreferrer nofollow" className="underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-slate-900">
                      {t(`sourceName.${s.source}`)}
                    </a>
                  ) : (
                    t(`sourceName.${s.source}`)
                  )}
                </p>
                <p className="text-xs text-slate-600">
                  {t("sourceFetched", { date: formatDrawDate(s.fetchedAt.slice(0, 10), locale, "short") })} · {t("sourceCount", { count: s.parsedCount })}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-slate-500" dir="ltr">
                  sha256 {s.sha256.slice(0, 16)}…
                </p>
              </div>
              <div className="shrink-0">
                <Badge tone={TONE[s.role]}>{t(`sourceRole.${s.role}`)}</Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

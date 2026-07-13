"use client";

import { useTranslations } from "next-intl";
import { Skeleton as Block } from "@/components/shadcn/skeleton";

/**
 * What a page looks like while its data loads: a title, a line of text, and cards or table rows
 * that shimmer. Shown by `loading.tsx` files, so the header and tabs stay in place.
 */
export function PageSkeleton({ variant = "table", rows = 8 }: { variant?: "table" | "cards"; rows?: number }) {
  const t = useTranslations("common.status");
  return (
    <div role="status" aria-label={t("loading")} aria-live="polite" className="flex flex-col gap-6 motion-reduce:*:animate-none">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-col gap-3">
        <Block className="h-9 w-64 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>
      {variant === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex gap-4 border-b border-line bg-surface-2 px-3 py-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Block key={i} className="h-4 flex-1 bg-line" />
            ))}
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex gap-4 border-b border-line px-3 py-3 last:border-0">
              {Array.from({ length: 4 }, (_, i) => (
                <Block key={i} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

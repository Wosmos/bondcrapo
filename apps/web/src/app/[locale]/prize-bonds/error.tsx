"use client";

import { useTranslations } from "next-intl";
import { Button, EmptyState } from "@/components/ui";

/** Unexpected errors in the prize bond pages: a calm message and a retry, no technical details. */
export default function PrizeBondsError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("bonds.common");
  return (
    <div role="alert">
      <EmptyState
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        action={
          <Button variant="secondary" onClick={reset}>
            {t("retry")}
          </Button>
        }
      />
    </div>
  );
}

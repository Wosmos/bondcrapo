import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";

type Status = "scheduled" | "published" | "verified" | "disputed";
const TONE = { scheduled: "neutral", published: "info", verified: "success", disputed: "warning" } as const;
const ICON = { scheduled: "◷", published: "○", verified: "✓", disputed: "!" } as const;

/** Status as text plus icon (never colour alone), with the explanation as the accessible description. */
export function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations("bonds.common");
  return (
    <span>
      <Badge tone={TONE[status]}>
        <span aria-hidden="true" className="me-1">
          {ICON[status]}
        </span>
        {t(`status.${status}`)}
      </Badge>
      <span className="sr-only">. {t(`statusHelp.${status}`)}</span>
    </span>
  );
}

export function CompletenessBadge({ completeness }: { completeness: "none" | "top" | "full" }) {
  const t = useTranslations("bonds.common");
  return <Badge tone={completeness === "full" ? "neutral" : completeness === "top" ? "info" : "neutral"}>{t(`completeness.${completeness}`)}</Badge>;
}

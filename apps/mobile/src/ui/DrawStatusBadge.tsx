import type { DrawSummary } from "@bondcheck/shared";
import { useI18n } from "@/i18n";
import { Badge, type BadgeTone } from "./Badge";
import type { IconName } from "./Button";

const MAP: Record<DrawSummary["status"], { tone: BadgeTone; icon: IconName }> = {
  verified: { tone: "success", icon: "shield-checkmark" },
  published: { tone: "info", icon: "document-text-outline" },
  disputed: { tone: "warning", icon: "alert-circle" },
  scheduled: { tone: "neutral", icon: "calendar-outline" },
};

export function DrawStatusBadge({ status }: { status: DrawSummary["status"] }) {
  const { t } = useI18n();
  const { tone, icon } = MAP[status];
  return <Badge tone={tone} icon={icon} label={t(`drawStatus.${status}`)} />;
}

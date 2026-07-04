import Ionicons from "@expo/vector-icons/Ionicons";
import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { Separator } from "@/components/rnr/separator";
import { cn } from "@/lib/utils";
import { useTheme } from "@/theme";
import type { IconName } from "./Button";
import { Text } from "./Text";

/**
 * Layout blocks shared by every screen, so spacing, radii and dividers are the same everywhere:
 * gaps of 8 (tight), 12 (default) and 16 (between sections), the medium radius for boxes inside
 * cards, and 16 by 12 padding with a 64 point minimum for rows, like ListRow (a comfortable touch target).
 */

export type NoticeTone = "info" | "warning" | "danger" | "success";

const NOTICE: Record<NoticeTone, { box: string; icon: IconName }> = {
  info: { box: "bg-info-container", icon: "information-circle" },
  warning: { box: "bg-warning-container", icon: "warning" },
  danger: { box: "bg-danger-container", icon: "alert-circle" },
  success: { box: "bg-success-container", icon: "checkmark-circle" },
};

/** A coloured note with an icon and text (never colour alone, WCAG 1.4.1). */
export function Notice({
  tone = "info",
  title,
  children,
  live = false,
}: {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  /** Announce changes to screen readers (for results that appear after an action). */
  live?: boolean;
}) {
  const { colors } = useTheme();
  const { box, icon } = NOTICE[tone];
  return (
    <View className={cn("flex-row gap-3 rounded-md p-3", box)} accessibilityLiveRegion={live ? "polite" : undefined}>
      <Ionicons name={icon} size={20} color={colors[tone]} accessibilityElementsHidden importantForAccessibility="no" />
      <View className="flex-1 gap-1">
        {title ? (
          <Text variant="label" tone={tone}>
            {title}
          </Text>
        ) : null}
        {typeof children === "string" ? <Text variant="caption">{children}</Text> : children}
      </View>
    </View>
  );
}

/** An inset box on the muted surface, for codes, numbers and short summaries. */
export function Panel({ children, center = false, className, ...rest }: ViewProps & { center?: boolean; className?: string }) {
  return (
    <View className={cn("gap-1 rounded-md bg-surface-muted p-3", center && "items-center py-5", className)} {...rest}>
      {children}
    </View>
  );
}

/** One row of a list inside a card: 16 by 12 padding, at least 64 points tall (same as ListRow). */
export function RowItem({ children, className, ...rest }: ViewProps & { className?: string }) {
  return (
    <View className={cn("min-h-16 flex-row items-center gap-3 px-4 py-3", className)} {...rest}>
      {children}
    </View>
  );
}

/** Rows with a hairline between them (not after the last); use inside `<Card padded={false}>`. */
export function Rows({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View>
      {items.map((child, i) => (
        <Fragment key={child.key ?? i}>
          {i > 0 ? <Separator /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

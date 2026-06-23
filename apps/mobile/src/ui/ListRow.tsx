import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { I18nManager, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import type { IconName } from "./Button";
import { Text } from "./Text";

export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  iconTone?: "primary" | "gold" | "info" | "danger" | "success";
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Hide the separator under the last row of a group. */
  last?: boolean;
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = "primary",
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  last = false,
}: ListRowProps) {
  const { colors } = useTheme();
  const toneBg = {
    primary: colors.primaryContainer,
    gold: colors.goldContainer,
    info: colors.infoContainer,
    danger: colors.dangerContainer,
    success: colors.successContainer,
  }[iconTone];
  const toneFg = {
    primary: colors.onPrimaryContainer,
    gold: colors.gold,
    info: colors.info,
    danger: colors.danger,
    success: colors.success,
  }[iconTone];

  const content = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: toneBg }]}>
          <Ionicons name={icon} size={20} color={toneFg} />
        </View>
      ) : null}
      <View style={styles.body}>
        {typeof title === "string" ? <Text variant="body" style={styles.title}>{title}</Text> : title}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text variant="caption" tone="textMuted">
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {trailing}
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textMuted}
          style={I18nManager.isRTL ? styles.flip : undefined}
        />
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: colors.ripple }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64, paddingVertical: 10, paddingHorizontal: 16 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  title: { fontWeight: "500" },
  flip: { transform: [{ scaleX: -1 }] },
});

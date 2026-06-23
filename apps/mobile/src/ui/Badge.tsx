import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import type { IconName } from "./Button";
import { Text } from "./Text";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "gold";

/** Status chip that always carries an icon and text, never colour alone (WCAG 1.4.1). */
export function Badge({ label, tone = "neutral", icon }: { label: string; tone?: BadgeTone; icon?: IconName }) {
  const { colors } = useTheme();
  const map = {
    neutral: [colors.surfaceMuted, colors.textMuted],
    success: [colors.successContainer, colors.success],
    warning: [colors.warningContainer, colors.warning],
    danger: [colors.dangerContainer, colors.danger],
    info: [colors.infoContainer, colors.info],
    gold: [colors.goldContainer, colors.gold],
  } as const;
  const [bg, fg] = map[tone];
  const textTone = tone === "neutral" ? "textMuted" : tone;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={14} color={fg} accessibilityElementsHidden importantForAccessibility="no" /> : null}
      <Text variant="caption" tone={textTone} style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  text: { fontWeight: "600" },
});

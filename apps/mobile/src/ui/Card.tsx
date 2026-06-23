import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./Text";

export function Card({
  title,
  action,
  children,
  tone = "surface",
  style,
  padded = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  tone?: "surface" | "primary" | "muted";
  style?: ViewStyle;
  padded?: boolean;
}) {
  const { colors, radius } = useTheme();
  const bg = tone === "primary" ? colors.primaryContainer : tone === "muted" ? colors.surfaceMuted : colors.surface;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderRadius: radius.lg, borderColor: colors.border, padding: padded ? 16 : 0 },
        style,
      ]}
    >
      {title || action ? (
        <View style={[styles.header, !padded && { paddingHorizontal: 16, paddingTop: 16 }]}>
          {title ? (
            <Text variant="heading" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 },
  title: { flexShrink: 1 },
});

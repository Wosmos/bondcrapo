import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

/** Scrollable page body with pull to refresh and the app background. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  contentStyle,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} progressBackgroundColor={colors.surface} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Stack({ gap = 12, children, style }: { gap?: number; children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Row({ gap = 8, children, style, wrap = false }: { gap?: number; children: ReactNode; style?: ViewStyle; wrap?: boolean }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
});

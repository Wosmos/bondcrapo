import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./Text";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  loading?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  size?: "md" | "lg";
}

export function Button({
  label,
  variant = "primary",
  icon,
  loading = false,
  disabled,
  block = false,
  size = "md",
  accessibilityHint,
  ...rest
}: ButtonProps) {
  const { colors, radius } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.border },
    ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
    danger: { bg: colors.dangerContainer, fg: colors.danger, border: colors.dangerContainer },
  }[variant];
  const inactive = Boolean(disabled || loading);
  const fgTone = variant === "primary" ? "onPrimary" : variant === "danger" ? "danger" : "primary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      android_ripple={{ color: colors.ripple, borderless: false }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === "lg" ? 56 : 48,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radius.pill,
          opacity: inactive ? 0.55 : pressed ? 0.9 : 1,
          alignSelf: block ? "stretch" : "flex-start",
        },
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={20} color={palette.fg} />
        ) : null}
        <Text variant="label" tone={fgTone} style={{ fontSize: size === "lg" ? 16 : 15 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, paddingHorizontal: 20, justifyContent: "center", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});

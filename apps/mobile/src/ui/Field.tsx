import { useId } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./Text";

export interface FieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  helper?: string;
  error?: string | null;
  /** Bond numbers and codes are typed left to right even in Urdu. */
  ltr?: boolean;
}

/** Labelled input; the error is announced and linked to the field for screen readers. */
export function Field({ label, helper, error, ltr = false, multiline, ...rest }: FieldProps) {
  const { colors, radius, fontFamily, lineHeight } = useTheme();
  const id = useId();
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
  return (
    <View style={styles.wrap}>
      <Text variant="label" nativeID={`${id}-label`}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityHint={error ?? helper}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        multiline={multiline}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            minHeight: multiline ? 120 : 52,
            textAlignVertical: multiline ? "top" : "center",
            fontFamily: ltr ? "monospace" : fontFamily(),
            lineHeight: ltr ? 24 : multiline ? lineHeight(16) : undefined,
            writingDirection: ltr ? "ltr" : undefined,
            textAlign: ltr ? "left" : undefined,
          },
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="danger" nativeID={`${id}-error`} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="textMuted" nativeID={`${id}-helper`}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});

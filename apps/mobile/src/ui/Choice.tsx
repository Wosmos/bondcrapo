import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./Text";

export interface ChoiceOption<V extends string> {
  value: V;
  label: string;
}

/** Single choice as a row of chips (radio group semantics). Scrolls when it does not fit. */
export function ChipGroup<V extends string>({
  label,
  options,
  value,
  onChange,
  scroll = true,
}: {
  label: string;
  options: readonly ChoiceOption<V>[];
  value: V;
  onChange: (value: V) => void;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const chips = options.map((o) => {
    const selected = o.value === value;
    return (
      <Pressable
        key={o.value}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={o.label}
        onPress={() => onChange(o.value)}
        android_ripple={{ color: colors.ripple, borderless: false }}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? colors.primary : colors.surface,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        <Text variant="label" tone={selected ? "onPrimary" : "text"}>
          {o.label}
        </Text>
      </Pressable>
    );
  });
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.wrap}>
      <Text variant="label" tone="textMuted">
        {label}
      </Text>
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {chips}
        </ScrollView>
      ) : (
        <View style={[styles.row, styles.wrapRow]}>{chips}</View>
      )}
    </View>
  );
}

/** Two to four mutually exclusive tabs inside a screen. */
export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly ChoiceOption<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, { borderRadius: radius.pill, backgroundColor: selected ? colors.surface : "transparent" }, selected && styles.raised]}
          >
            <Text variant="label" tone={selected ? "primary" : "textMuted"}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  wrapRow: { flexWrap: "wrap" },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, justifyContent: "center", overflow: "hidden" },
  segmented: { flexDirection: "row", padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  raised: { elevation: 1, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
});

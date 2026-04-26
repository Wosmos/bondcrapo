import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { classifyError, type ErrorKind } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";
import { Button, type IconName } from "./Button";
import { Text } from "./Text";

const ERROR_ICON: Record<ErrorKind, IconName> = {
  offline: "cloud-offline-outline",
  unavailable: "construct-outline",
  comingSoon: "time-outline",
  unauthorized: "lock-closed-outline",
  rateLimited: "hourglass-outline",
  invalid: "alert-circle-outline",
  notFound: "search-outline",
  unknown: "alert-circle-outline",
  notConfigured: "settings-outline",
};

export function LoadingView({ label }: { label?: string }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? t("state.loading")} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text tone="textMuted">{label ?? t("state.loading")}</Text>
    </View>
  );
}

export function ErrorView({ error, onRetry, compact = false }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const kind = classifyError(error);
  return (
    <View style={[styles.center, compact && styles.compact]} accessibilityLiveRegion="polite">
      <Ionicons name={ERROR_ICON[kind]} size={compact ? 28 : 40} color={colors.textMuted} />
      <Text variant="heading" align="center">
        {t(`errors.${kind}.title`)}
      </Text>
      <Text tone="textMuted" align="center">
        {t(`errors.${kind}.body`)}
      </Text>
      {onRetry && kind !== "comingSoon" && kind !== "notConfigured" ? (
        <Button label={t("common.actions.retry")} icon="refresh" variant="secondary" onPress={onRetry} />
      ) : null}
    </View>
  );
}

export function EmptyView({ icon = "file-tray-outline", title, body, action }: { icon?: IconName; title: string; body?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="textMuted" align="center">
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

/** Small "showing saved data" notice for cache hits that could not be refreshed. */
export function StaleNotice({ savedAt }: { savedAt: number | null }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  if (!savedAt) return null;
  const minutes = Math.max(1, Math.round((Date.now() - savedAt) / 60000));
  const age = minutes < 60 ? t("state.minutesAgo", { count: minutes }) : t("state.hoursAgo", { count: Math.round(minutes / 60) });
  return (
    <View style={[styles.stale, { backgroundColor: colors.warningContainer }]} accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
      <Text variant="caption" tone="warning" style={{ flex: 1 }}>
        {t("state.savedCopy", { age })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  compact: { paddingVertical: 20 },
  stale: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
});

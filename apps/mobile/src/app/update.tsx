import Ionicons from "@expo/vector-icons/Ionicons";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { BackHandler, Linking, View } from "react-native";
import { useI18n } from "@/i18n";
import { apiBaseUrl } from "@/lib/config";
import { formatBytes, formatDate } from "@/lib/format";
import { isTrustedDownloadUrl, resolveDownloadUrl } from "@/lib/update";
import { useUpdate } from "@/lib/update-context";
import { useTheme } from "@/theme";
import { Button, Card, Num, Row, Screen, Text } from "@/ui";

export default function UpdateScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const { state } = useUpdate();
  const required = state.kind === "required";

  // A required update cannot be skipped with the back button.
  useEffect(() => {
    if (!required) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [required]);

  if (state.kind === "current") {
    return (
      <Screen>
        <Card>
          <View style={{ gap: 12 }}>
            <Text variant="heading">{t("settings.upToDate")}</Text>
            <Button label={t("common.actions.close")} onPress={() => router.back()} />
          </View>
        </Card>
      </Screen>
    );
  }

  const { manifest } = state;
  const base = apiBaseUrl();
  const trusted = isTrustedDownloadUrl(manifest.url, base);
  const size = formatBytes(manifest.size);

  return (
    <Screen>
      <Stack.Screen options={{ headerBackVisible: !required, gestureEnabled: !required }} />
      <Card>
        <View style={{ gap: 14 }}>
          <Row gap={12}>
            <Ionicons name={required ? "alert-circle" : "sparkles"} size={30} color={required ? colors.warning : colors.primary} />
            <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>
              {required ? t("update.requiredTitle") : t("update.availableTitle", { version: manifest.version })}
            </Text>
          </Row>
          <Text>{required ? t("update.requiredBody") : t("update.availableBody")}</Text>
          <Row gap={8} wrap>
            <Num tone="textMuted">v{manifest.version}</Num>
            {size ? <Text tone="textMuted">· {size}</Text> : null}
            {manifest.publishedAt ? <Text tone="textMuted">· {formatDate(manifest.publishedAt.slice(0, 10), locale)}</Text> : null}
          </Row>
          {manifest.notes ? (
            <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, gap: 4 }}>
              <Text variant="label">{t("update.notes")}</Text>
              <Text variant="caption">{manifest.notes}</Text>
            </View>
          ) : null}
          <Text variant="caption" tone="textMuted">
            {t("update.howTo")}
          </Text>
          <Text variant="caption" tone="textMuted">
            {t("update.checksum")}
          </Text>
          <Num variant="caption" mono tone="textMuted" selectable>
            {manifest.sha256}
          </Num>
          <Button
            label={t("update.download")}
            icon="download-outline"
            size="lg"
            block
            disabled={!trusted || !base}
            onPress={() => base && void Linking.openURL(resolveDownloadUrl(manifest.url, base))}
          />
          {!trusted ? (
            <Text variant="caption" tone="danger">
              {t("update.untrusted")}
            </Text>
          ) : null}
          {!required ? <Button label={t("update.later")} variant="ghost" block onPress={() => router.back()} /> : null}
        </View>
      </Card>
    </Screen>
  );
}

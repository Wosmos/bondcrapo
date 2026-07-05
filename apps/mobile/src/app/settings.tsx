import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Switch, View } from "react-native";
import { applyLayoutDirection, needsDirectionChange, useI18n } from "@/i18n";
import { classifyError } from "@/lib/api";
import { configureBackgroundChecks } from "@/lib/background";
import { apiBaseUrl, appVersion, installedVersionCode } from "@/lib/config";
import { requestNotificationPermission, syncDrawReminders } from "@/lib/notifications";
import { useSettings, type Settings } from "@/lib/settings";
import { useUpdate } from "@/lib/update-context";
import { useWallet } from "@/lib/wallet";
import { formatSyncCode } from "@/lib/wallet-store";
import { useTheme } from "@/theme";
import { Button, Card, ChipGroup, ListRow, Notice, Num, RowItem, Rows, Screen, Stack, Text } from "@/ui";

export default function SettingsScreen() {
  const { t, locale } = useI18n();
  const { settings, update } = useSettings();
  const wallet = useWallet();
  const updates = useUpdate();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const changeLocale = async (next: Settings["locale"]) => {
    if (next === settings.locale) return;
    await update({ locale: next });
    if (needsDirectionChange(next)) await applyLayoutDirection(next);
  };

  const toggle = async (key: "drawReminders" | "winAlerts", value: boolean) => {
    setNote(null);
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setNote(t("settings.notificationsDenied"));
        return;
      }
    }
    const next = await update({ [key]: value });
    try {
      if (key === "drawReminders") {
        const count = await syncDrawReminders(next.locale, value);
        if (value) setNote(t("settings.remindersScheduled", { count }));
      }
      await configureBackgroundChecks(next.winAlerts || next.drawReminders);
    } catch (e) {
      setNote(t(`errors.${classifyError(e)}.body`));
    }
  };

  const checkForUpdate = async () => {
    setBusy("update");
    try {
      const state = await updates.check();
      if (state.kind === "current") setNote(t("settings.upToDate"));
      else router.push("/update");
    } catch (e) {
      // No published release yet means there is nothing newer than this build.
      const kind = classifyError(e);
      setNote(kind === "notFound" ? t("settings.upToDate") : t(`errors.${kind}.body`));
    } finally {
      setBusy(null);
    }
  };

  const rotate = () =>
    Alert.alert(t("settings.rotateTitle"), t("settings.rotateBody"), [
      { text: t("common.actions.close"), style: "cancel" },
      {
        text: t("settings.rotate"),
        onPress: async () => {
          try {
            await wallet.rotate();
            router.push("/wallet/created");
          } catch (e) {
            setNote(t(`errors.${classifyError(e)}.body`));
          }
        },
      },
    ]);

  const remove = () =>
    Alert.alert(t("settings.deleteTitle"), t("settings.deleteBody"), [
      { text: t("common.actions.close"), style: "cancel" },
      {
        text: t("settings.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await wallet.remove();
            await syncDrawReminders(locale, false);
            setNote(t("settings.deleted"));
          } catch (e) {
            setNote(t(`errors.${classifyError(e)}.body`));
          }
        },
      },
    ]);

  const site = apiBaseUrl();

  return (
    <Screen>
      {note ? (
        <Notice tone="info" live>
          {note}
        </Notice>
      ) : null}

      <Card title={t("settings.language")}>
        <Stack gap={8}>
          <ChipGroup
            label={t("settings.languageLabel")}
            scroll={false}
            value={settings.locale}
            onChange={(v) => void changeLocale(v)}
            options={[
              { value: "en", label: "English" },
              { value: "ur", label: "اردو" },
            ]}
          />
          <Text variant="caption" tone="textMuted">
            {t("settings.languageNote")}
          </Text>
        </Stack>
      </Card>

      <Card title={t("settings.appearance")}>
        <ChipGroup
          label={t("settings.themeLabel")}
          scroll={false}
          value={settings.theme}
          onChange={(v) => void update({ theme: v })}
          options={[
            { value: "system", label: t("settings.themeSystem") },
            { value: "light", label: t("settings.themeLight") },
            { value: "dark", label: t("settings.themeDark") },
          ]}
        />
      </Card>

      <Card title={t("settings.notifications")} padded={false}>
        <Rows>
          <SwitchRow
            title={t("settings.drawReminders")}
            subtitle={t("settings.drawRemindersHelp")}
            value={settings.drawReminders}
            disabled={wallet.state.status !== "ready"}
            onChange={(v) => void toggle("drawReminders", v)}
          />
          <SwitchRow
            title={t("settings.winAlerts")}
            subtitle={t("settings.winAlertsHelp")}
            value={settings.winAlerts}
            disabled={wallet.state.status !== "ready"}
            onChange={(v) => void toggle("winAlerts", v)}
          />
        </Rows>
        {wallet.state.status !== "ready" ? (
          <View className="px-4 pb-4">
            <Text variant="caption" tone="textMuted">
              {t("settings.needsWallet")}
            </Text>
          </View>
        ) : null}
      </Card>

      {wallet.state.status === "ready" ? (
        <Card title={t("settings.wallet")}>
          <View className="gap-3">
            <Text variant="label">{t("settings.syncCode")}</Text>
            <Num variant="heading" mono selectable>
              {wallet.state.syncCode ? formatSyncCode(wallet.state.syncCode) : t("settings.syncCodeUnknown")}
            </Num>
            <Text variant="caption" tone="textMuted">
              {t("settings.syncCodeHelp")}
            </Text>
            <Button label={t("settings.rotate")} icon="refresh" variant="secondary" onPress={rotate} />
            <Button label={t("settings.delete")} icon="trash-outline" variant="danger" onPress={remove} />
          </View>
        </Card>
      ) : null}

      <Card title={t("settings.about")} padded={false}>
        <ListRow
          icon="information-circle-outline"
          title={t("settings.version")}
          trailing={<Num tone="textMuted">{`${appVersion()} (${installedVersionCode() ?? "dev"})`}</Num>}
        />
        <ListRow
          icon="cloud-download-outline"
          title={busy === "update" ? t("state.loading") : t("settings.checkUpdates")}
          onPress={() => void checkForUpdate()}
        />
        {site ? (
          <ListRow icon="globe-outline" title={t("settings.website")} subtitle={new URL(site).host} onPress={() => void Linking.openURL(site)} />
        ) : null}
        <ListRow
          icon="lock-closed-outline"
          title={t("settings.privacy")}
          subtitle={t("settings.privacySummary")}
          onPress={site ? () => void Linking.openURL(`${site}/${locale}/privacy`) : undefined}
          last
        />
      </Card>
    </Screen>
  );
}

function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <RowItem>
      <View className="flex-1 gap-0.5">
        <Text>{title}</Text>
        <Text variant="caption" tone="textMuted">
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={title}
        accessibilityHint={subtitle}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </RowItem>
  );
}

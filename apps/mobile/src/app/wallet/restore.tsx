import { syncCodeSchema } from "@bondcheck/shared";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useI18n } from "@/i18n";
import { classifyError } from "@/lib/api";
import { useWallet } from "@/lib/wallet";
import { Button, Card, Field, Screen, Text } from "@/ui";

export default function RestoreWallet() {
  const { t } = useI18n();
  const wallet = useWallet();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restore = async () => {
    const parsed = syncCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(t("walletRestore.invalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await wallet.restore(parsed.data);
      router.replace("/wallet/created");
    } catch (e) {
      const kind = classifyError(e);
      setError(
        kind === "unauthorized" || kind === "notFound" || kind === "invalid"
          ? t("walletRestore.notFound")
          : kind === "rateLimited"
            ? t("walletRestore.rateLimited")
            : t(`errors.${kind}.body`),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <View className="gap-4">
          <Text tone="textMuted">{t("walletRestore.intro")}</Text>
          <Field
            label={t("walletRestore.codeLabel")}
            helper={t("walletRestore.codeHelp")}
            error={error}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            ltr
            maxLength={16}
            onSubmitEditing={() => void restore()}
            returnKeyType="done"
          />
          <Button label={t("walletRestore.submit")} icon="key-outline" size="lg" block loading={busy} onPress={() => void restore()} />
          <Text variant="caption" tone="textMuted">
            {t("walletRestore.note")}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

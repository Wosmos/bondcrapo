import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { AccessibilityInfo, Share, View } from "react-native";
import { useI18n } from "@/i18n";
import { useWallet } from "@/lib/wallet";
import { formatSyncCode } from "@/lib/wallet-store";
import { useTheme } from "@/theme";
import { Button, Card, Num, Row, Screen, Text } from "@/ui";

/** Shown right after creating or restoring a wallet: the sync code must be saved now. */
export default function WalletCreated() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const wallet = useWallet();
  const [copied, setCopied] = useState(false);
  const code = wallet.state.status === "ready" ? wallet.state.syncCode : null;
  const formatted = code ? formatSyncCode(code) : "";

  const copy = async () => {
    await Clipboard.setStringAsync(formatted);
    setCopied(true);
    AccessibilityInfo.announceForAccessibility(t("walletCreated.copied"));
  };

  return (
    <Screen>
      <Card>
        <View style={{ gap: 16, alignItems: "stretch" }}>
          <Row gap={12}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
            <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>
              {t("walletCreated.heading")}
            </Text>
          </Row>
          <Text>{t("walletCreated.body")}</Text>
          <View
            style={{ backgroundColor: colors.surfaceMuted, borderRadius: 16, paddingVertical: 20, alignItems: "center" }}
            accessible
            accessibilityLabel={t("walletCreated.codeA11y", { code: formatted.split("").join(" ") })}
          >
            <Num variant="title" mono selectable>
              {formatted || "------------"}
            </Num>
          </View>
          <Row gap={8} wrap>
            <Button label={copied ? t("walletCreated.copied") : t("walletCreated.copy")} icon={copied ? "checkmark" : "copy-outline"} variant="secondary" onPress={() => void copy()} />
            <Button
              label={t("walletCreated.share")}
              icon="share-outline"
              variant="secondary"
              onPress={() => void Share.share({ message: t("walletCreated.shareMessage", { code: formatted }) })}
            />
          </Row>
          <Text variant="caption" tone="warning">
            {t("walletCreated.warning")}
          </Text>
          <Button label={t("walletCreated.done")} size="lg" block onPress={() => router.dismissTo("/wallet")} />
        </View>
      </Card>
    </Screen>
  );
}

import Ionicons from "@expo/vector-icons/Ionicons";
import { deleteWalletBond, listWalletBonds, listWalletMatches, markMatchesSeen } from "@bondcheck/shared";
import { getCalendars } from "expo-localization";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n";
import { api, classifyError } from "@/lib/api";
import { denominationLabel, faceValueOf } from "@/lib/denominations";
import { formatDate, formatPkr, groupDigits } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { useTheme } from "@/theme";
import { Badge, Button, Card, EmptyView, ErrorView, LoadingView, Num, Row, Screen, Segmented, StaleNotice, Text } from "@/ui";

export default function WalletScreen() {
  const wallet = useWallet();
  if (wallet.state.status === "loading") return <LoadingView />;
  if (wallet.state.status === "none") return <WalletOnboarding />;
  return <WalletHome />;
}

function WalletOnboarding() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await wallet.create({ locale, timezone: getCalendars()[0]?.timeZone ?? undefined });
      router.push("/wallet/created");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const points = [
    { icon: "person-remove-outline" as const, text: t("wallet.pointNoAccount") },
    { icon: "notifications-outline" as const, text: t("wallet.pointAlerts") },
    { icon: "phone-portrait-outline" as const, text: t("wallet.pointSync") },
  ];

  return (
    <Screen>
      <Card>
        <View style={{ gap: 16 }}>
          <View style={[styles.hero, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="wallet" size={36} color={colors.onPrimaryContainer} />
          </View>
          <Text variant="title" accessibilityRole="header">
            {t("wallet.onboardingTitle")}
          </Text>
          <Text tone="textMuted">{t("wallet.onboardingBody")}</Text>
          <View style={{ gap: 12 }}>
            {points.map((p) => (
              <Row key={p.icon} gap={12}>
                <Ionicons name={p.icon} size={22} color={colors.primary} />
                <Text style={{ flex: 1 }}>{p.text}</Text>
              </Row>
            ))}
          </View>
          {error ? <ErrorView compact error={error} /> : null}
          <Button label={t("wallet.create")} icon="add-circle-outline" size="lg" block loading={busy} onPress={() => void create()} />
          <Button label={t("wallet.restore")} icon="key-outline" variant="secondary" block onPress={() => router.push("/wallet/restore")} />
          <Text variant="caption" tone="textMuted">
            {t("wallet.privacyNote")}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

function WalletHome() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const wallet = useWallet();
  const [tab, setTab] = useState<"bonds" | "wins">("bonds");
  const bonds = useResource("wallet.bonds", async () => (await api().call(listWalletBonds)).data);
  const matches = useResource("wallet.matches", async () => (await api().call(listWalletMatches)).data);

  useFocusEffect(
    useCallback(() => {
      void bonds.refresh();
      void matches.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const bondList = bonds.data;
  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof bondList>>();
    for (const b of bondList ?? []) map.set(b.denominationCode, [...(map.get(b.denominationCode) ?? []), b]);
    return [...map.entries()].sort((a, b) => faceValueOf(a[0]) - faceValueOf(b[0]));
  }, [bondList]);

  const faceValue = (bonds.data ?? []).reduce((sum, b) => sum + faceValueOf(b.denominationCode), 0);
  const winnings = (matches.data ?? []).reduce((sum, m) => sum + m.amountPkr, 0);
  const unseen = (matches.data ?? []).filter((m) => m.seenAt === null).length;

  const unauthorized = [bonds.error, matches.error].some((e) => e && classifyError(e) === "unauthorized");

  const removeBond = (denominationCode: string, bondNumber: string) => {
    Alert.alert(t("wallet.removeTitle"), t("wallet.removeBody", { number: bondNumber }), [
      { text: t("common.actions.close"), style: "cancel" },
      {
        text: t("wallet.remove"),
        style: "destructive",
        onPress: async () => {
          try {
            await api().call(deleteWalletBond, { params: { denomination: denominationCode, number: bondNumber } });
            await bonds.refresh();
          } catch (e) {
            Alert.alert(t(`errors.${classifyError(e)}.title`), t(`errors.${classifyError(e)}.body`));
          }
        },
      },
    ]);
  };

  const markSeen = async () => {
    try {
      await api().call(markMatchesSeen, { body: {} });
      await matches.refresh();
    } catch {
      // The list still shows; the next refresh retries.
    }
  };

  if (unauthorized) {
    return (
      <Screen>
        <EmptyView
          icon="lock-closed-outline"
          title={t("wallet.lostAccessTitle")}
          body={t("wallet.lostAccessBody")}
          action={
            <View style={{ gap: 8, alignSelf: "stretch" }}>
              <Button label={t("wallet.restore")} icon="key-outline" block onPress={() => router.push("/wallet/restore")} />
              <Button label={t("wallet.forget")} variant="ghost" block onPress={() => void wallet.forget()} />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={() => {
        void bonds.refresh();
        void matches.refresh();
      }}
      refreshing={bonds.refreshing || matches.refreshing}
    >
      {(bonds.stale && bonds.error) || (matches.stale && matches.error) ? <StaleNotice savedAt={bonds.savedAt ?? matches.savedAt} /> : null}

      <View style={styles.stats}>
        <Stat label={t("wallet.statBonds")} value={groupDigits(bonds.data?.length ?? 0)} />
        <Stat label={t("wallet.statFaceValue")} value={formatPkr(faceValue, locale)} hint={t("wallet.computed")} />
        <Stat label={t("wallet.statWinnings")} value={formatPkr(winnings, locale)} />
      </View>

      {unseen > 0 ? (
        <Card tone="primary">
          <Row gap={12}>
            <Ionicons name="trophy" size={28} color={colors.gold} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="heading" tone="onPrimaryContainer">
                {t("wallet.newWins", { count: unseen })}
              </Text>
              <Text variant="caption" tone="onPrimaryContainer">
                {t("wallet.claimReminder")}
              </Text>
            </View>
          </Row>
        </Card>
      ) : null}

      <Row gap={8}>
        <View style={{ flex: 1 }}>
          <Segmented
            label={t("wallet.viewLabel")}
            value={tab}
            onChange={setTab}
            options={[
              { value: "bonds", label: t("wallet.tabBonds") },
              { value: "wins", label: t("wallet.tabWins", { count: matches.data?.length ?? 0 }) },
            ]}
          />
        </View>
      </Row>

      {tab === "bonds" ? (
        <>
          <Button label={t("wallet.addBonds")} icon="add" block onPress={() => router.push("/wallet/add")} />
          {bonds.status === "loading" ? (
            <LoadingView />
          ) : bonds.status === "error" ? (
            <ErrorView error={bonds.error} onRetry={bonds.refresh} />
          ) : grouped.length === 0 ? (
            <EmptyView icon="documents-outline" title={t("wallet.emptyTitle")} body={t("wallet.emptyBody")} />
          ) : (
            grouped.map(([code, list]) => (
              <Card key={code} title={`${denominationLabel(code, t)} (${groupDigits(list.length)})`} padded={false}>
                {list.map((b, i) => (
                  <View
                    key={b.bondNumber}
                    style={[styles.bondRow, i < list.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Num variant="heading" mono>
                        {b.bondNumber}
                      </Num>
                      {b.label ? (
                        <Text variant="caption" tone="textMuted">
                          {b.label}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => removeBond(code, b.bondNumber)}
                      accessibilityRole="button"
                      accessibilityLabel={t("wallet.removeA11y", { number: b.bondNumber.split("").join(" ") })}
                      android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
                      style={styles.iconButton}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            ))
          )}
        </>
      ) : matches.status === "loading" ? (
        <LoadingView />
      ) : matches.status === "error" ? (
        <ErrorView error={matches.error} onRetry={matches.refresh} />
      ) : (matches.data ?? []).length === 0 ? (
        <EmptyView icon="trophy-outline" title={t("wallet.noWinsTitle")} body={t("wallet.noWinsBody")} />
      ) : (
        <>
          {unseen > 0 ? <Button label={t("wallet.markSeen")} variant="secondary" icon="checkmark-done" onPress={() => void markSeen()} /> : null}
          <Card padded={false}>
            {(matches.data ?? []).map((m, i, all) => (
              <View
                key={`${m.drawId}-${m.bondNumber}`}
                accessible
                accessibilityLabel={t("check.winA11y", {
                  number: m.bondNumber.split("").join(" "),
                  tier: t(`tier.${m.tier}`),
                  amount: formatPkr(m.amountPkr, locale),
                  date: formatDate(m.drawDate, locale),
                })}
                style={[styles.bondRow, i < all.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Num variant="heading" mono>
                    {m.bondNumber}
                  </Num>
                  <Text variant="caption" tone="textMuted">
                    {denominationLabel(m.denominationCode, t)} · {formatDate(m.drawDate, locale)}
                  </Text>
                  <Text variant="label" tone="success">
                    {t(`tier.${m.tier}`)} · {formatPkr(m.amountPkr, locale)}
                  </Text>
                </View>
                {m.seenAt === null ? <Badge tone="gold" icon="sparkles" label={t("wallet.new")} /> : null}
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ""}`}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      <Num variant="heading">{value}</Num>
      {hint ? (
        <Text variant="caption" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { flexGrow: 1, flexBasis: "30%", minWidth: 100, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  bondRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});

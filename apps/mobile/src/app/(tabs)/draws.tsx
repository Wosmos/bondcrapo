import { DENOMINATIONS, latestDraws } from "@bondcheck/shared";
import { router } from "expo-router";
import { View } from "react-native";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { denominationLabel } from "@/lib/denominations";
import { formatDate } from "@/lib/format";
import { Card, DrawStatusBadge, ErrorView, ListRow, Screen, StaleNotice, Text } from "@/ui";

export default function DrawsScreen() {
  const { t, locale } = useI18n();
  const latest = useResource("bonds.latest", async () => (await api().call(latestDraws)).data);
  const byCode = new Map((latest.data ?? []).map((d) => [d.denominationCode, d]));

  const groups = [
    { key: "active", title: t("draws.active"), items: DENOMINATIONS.filter((d) => d.active) },
    { key: "discontinued", title: t("draws.discontinued"), items: DENOMINATIONS.filter((d) => !d.active) },
  ];

  return (
    <Screen onRefresh={() => void latest.refresh()} refreshing={latest.refreshing}>
      <Text tone="textMuted">{t("draws.intro")}</Text>
      {latest.stale && latest.error ? <StaleNotice savedAt={latest.savedAt} /> : null}
      {latest.status === "error" ? <ErrorView compact error={latest.error} onRetry={latest.refresh} /> : null}
      {groups.map((g) => (
        <Card key={g.key} title={g.title} padded={false}>
          {g.items.map((d, i) => {
            const last = byCode.get(d.code);
            return (
              <ListRow
                key={d.code}
                icon={d.kind === "premium_registered" ? "ribbon-outline" : "cash-outline"}
                iconTone={d.active ? "primary" : "info"}
                title={denominationLabel(d.code, t)}
                subtitle={
                  last
                    ? t("draws.lastDraw", { date: formatDate(last.drawDate, locale) })
                    : latest.status === "loading"
                      ? t("state.loading")
                      : t("draws.noRecentDraw")
                }
                trailing={last ? <DrawStatusBadge status={last.status} /> : undefined}
                onPress={() => router.push({ pathname: "/draws/[code]", params: { code: d.code } })}
                last={i === g.items.length - 1}
              />
            );
          })}
        </Card>
      ))}
      <View style={{ paddingHorizontal: 4 }}>
        <Text variant="caption" tone="textMuted">
          {t("draws.sourceNote")}
        </Text>
      </View>
    </Screen>
  );
}

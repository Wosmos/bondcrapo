import { getSchedule, getWallet, latestDraws } from "@bondcheck/shared";
import { router } from "expo-router";
import { View } from "react-native";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { denominationLabel } from "@/lib/denominations";
import { daysUntil, formatDate, todayIso } from "@/lib/format";
import { useUpdate } from "@/lib/update-context";
import { useWallet } from "@/lib/wallet";
import {
  Badge,
  Button,
  Card,
  DrawStatusBadge,
  ErrorView,
  ListRow,
  LoadingView,
  Num,
  Row,
  Screen,
  StaleNotice,
  Text,
} from "@/ui";

export default function HomeScreen() {
  const { t, locale } = useI18n();
  const wallet = useWallet();
  const update = useUpdate();
  const year = new Date().getFullYear();

  const latest = useResource("bonds.latest", async () => (await api().call(latestDraws)).data);
  const schedule = useResource(`bonds.schedule.${year}`, async () => (await api().call(getSchedule, { query: { year } })).data);
  const profile = useResource(
    wallet.state.status === "ready" ? `wallet.profile` : null,
    async () => (await api().call(getWallet)).data,
  );

  const today = todayIso();
  const upcoming = (schedule.data?.draws ?? [])
    .filter((d) => d.status === "scheduled" && d.drawDate >= today)
    .sort((a, b) => a.drawDate.localeCompare(b.drawDate))
    .slice(0, 4);

  const refreshing = latest.refreshing || schedule.refreshing;
  const refresh = () => {
    void latest.refresh();
    void schedule.refresh();
    void profile.refresh();
  };

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      {update.state.kind === "optional" && !update.dismissed ? (
        <Card tone="primary">
          <View className="gap-2" accessibilityLiveRegion="polite">
            <Text variant="heading" tone="onPrimaryContainer">
              {t("update.availableTitle", { version: update.state.manifest.version })}
            </Text>
            <Text tone="onPrimaryContainer">{t("update.availableBody")}</Text>
            <Row gap={8} wrap>
              <Button label={t("update.view")} icon="download-outline" onPress={() => router.push("/update")} />
              <Button label={t("update.later")} variant="ghost" onPress={update.dismiss} />
            </Row>
          </View>
        </Card>
      ) : null}

      <Card>
        <View className="gap-3">
          <Text variant="title" accessibilityRole="header">
            {t("home.heroTitle")}
          </Text>
          <Text tone="textMuted">{t("common.tagline")}</Text>
          <Row gap={8} wrap>
            <Button label={t("home.checkCta")} icon="search" onPress={() => router.push("/check")} />
            <Button
              label={t("home.scanCta")}
              icon="camera-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: "/check", params: { scan: "1" } })}
            />
          </Row>
        </View>
      </Card>

      {wallet.state.status === "ready" ? (
        <Card title={t("home.walletTitle")} padded={false}>
          {profile.data ? (
            <ListRow
              icon="wallet"
              title={t("home.walletBonds", { count: profile.data.bondCount })}
              subtitle={t("home.walletWins", { count: profile.data.matchCount })}
              trailing={profile.data.hasUnseenMatches ? <Badge tone="gold" icon="trophy" label={t("home.newWin")} /> : undefined}
              onPress={() => router.push("/wallet")}
              last
            />
          ) : profile.status === "error" ? (
            <ErrorView compact error={profile.error} onRetry={profile.refresh} />
          ) : (
            <LoadingView />
          )}
        </Card>
      ) : wallet.state.status === "none" ? (
        <Card tone="muted" padded={false}>
          <ListRow
            icon="shield-checkmark-outline"
            title={t("home.walletPromoTitle")}
            subtitle={t("home.walletPromoBody")}
            onPress={() => router.push("/wallet")}
            last
          />
        </Card>
      ) : null}

      <Card title={t("home.nextDraws")} padded={false}>
        {schedule.status === "loading" ? (
          <LoadingView />
        ) : schedule.status === "error" ? (
          <ErrorView compact error={schedule.error} onRetry={schedule.refresh} />
        ) : upcoming.length === 0 ? (
          <View className="p-4">
            <Text tone="textMuted">{t("home.noUpcoming")}</Text>
          </View>
        ) : (
          upcoming.map((d, i) => {
            const days = daysUntil(d.drawDate);
            return (
              <ListRow
                key={`${d.denominationCode}-${d.drawDate}`}
                icon="calendar-outline"
                iconTone="info"
                title={denominationLabel(d.denominationCode, t)}
                subtitle={[formatDate(d.drawDate, locale), d.city].filter(Boolean).join(" · ")}
                trailing={
                  <Badge
                    tone={days <= 1 ? "warning" : "neutral"}
                    icon="time-outline"
                    label={days === 0 ? t("home.today") : days === 1 ? t("home.tomorrow") : t("home.inDays", { count: days })}
                  />
                }
                last={i === upcoming.length - 1}
              />
            );
          })
        )}
      </Card>

      <Card
        title={t("home.latestResults")}
        padded={false}
        // The card header already pads 16 on each side; extra padding here pushed the button out of line.
        action={<Button label={t("home.allResults")} variant="ghost" onPress={() => router.push("/draws")} />}
      >
        {latest.stale && latest.error ? (
          <View className="px-4">
            <StaleNotice savedAt={latest.savedAt} />
          </View>
        ) : null}
        {latest.status === "loading" ? (
          <LoadingView />
        ) : latest.status === "error" ? (
          <ErrorView compact error={latest.error} onRetry={latest.refresh} />
        ) : (latest.data ?? []).length === 0 ? (
          <View className="p-4">
            <Text tone="textMuted">{t("home.noResults")}</Text>
          </View>
        ) : (
          (latest.data ?? []).map((d, i, all) => (
            <ListRow
              key={d.id}
              icon="trophy-outline"
              iconTone="gold"
              title={denominationLabel(d.denominationCode, t)}
              subtitle={
                <Row gap={6} wrap>
                  <Text variant="caption" tone="textMuted">
                    {formatDate(d.drawDate, locale)}
                  </Text>
                  {d.drawNumber !== null ? (
                    <Num variant="caption" tone="textMuted">
                      #{d.drawNumber}
                    </Num>
                  ) : null}
                </Row>
              }
              trailing={<DrawStatusBadge status={d.status} />}
              accessibilityLabel={`${denominationLabel(d.denominationCode, t)}, ${formatDate(d.drawDate, locale)}`}
              onPress={
                d.drawNumber !== null
                  ? () => router.push({ pathname: "/draws/[code]/[number]", params: { code: d.denominationCode, number: String(d.drawNumber) } })
                  : undefined
              }
              last={i === all.length - 1}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

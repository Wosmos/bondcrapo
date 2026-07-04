import { checkBonds, getDraw, isBondNumber, listDrawResults } from "@bondcheck/shared";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { denominationLabel } from "@/lib/denominations";
import { formatDate, formatDateTime, formatPkr, groupDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, DrawStatusBadge, ErrorView, Field, LoadingView, Notice, Num, Row, RowItem, Rows, Screen, StaleNotice, Text } from "@/ui";

const PAGE_SIZE = 200;

export default function DrawDetail() {
  const { code, number } = useLocalSearchParams<{ code: string; number: string }>();
  const { t, locale } = useI18n();
  const drawNumber = Number.parseInt(number ?? "", 10);
  const valid = Boolean(code) && Number.isInteger(drawNumber) && drawNumber > 0;

  const draw = useResource(valid ? `bonds.draw.${code}.${drawNumber}` : null, async () =>
    (await api().call(getDraw, { params: { denomination: code!, drawNumber } })).data,
  );

  const [third, setThird] = useState<{ numbers: string[]; page: number; total: number } | null>(null);
  const [thirdBusy, setThirdBusy] = useState(false);
  const [thirdError, setThirdError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<{ busy: boolean; message: string | null; win: boolean }>({ busy: false, message: null, win: false });

  const loadThird = async () => {
    setThirdBusy(true);
    setThirdError(null);
    try {
      const page = (third?.page ?? 0) + 1;
      const { data, meta } = await api().call(listDrawResults, {
        params: { denomination: code!, drawNumber },
        query: { tier: 3, page, pageSize: PAGE_SIZE },
      });
      const total = typeof meta?.total === "number" ? meta.total : data.length;
      setThird((prev) => ({ numbers: [...(prev?.numbers ?? []), ...data.map((r) => r.bondNumber)], page, total }));
    } catch (e) {
      setThirdError(e);
    } finally {
      setThirdBusy(false);
    }
  };

  const findNumber = async () => {
    if (!isBondNumber(query) || !draw.data) return;
    setLookup({ busy: true, message: null, win: false });
    try {
      const { data } = await api().call(checkBonds, { body: { items: [{ denomination: code!, number: query }] } });
      const win = data.wins.find((w) => w.drawId === draw.data!.id);
      const message = win
        ? t("draw.lookupWin", { tier: t(`tier.${win.tier}`), amount: formatPkr(win.amountPkr, locale) })
        : t("draw.lookupNone");
      setLookup({ busy: false, message, win: Boolean(win) });
      AccessibilityInfo.announceForAccessibility(message);
    } catch {
      setLookup({ busy: false, message: t("errors.unknown.title"), win: false });
    }
  };

  if (!valid) return <Screen><ErrorView error={new Error("invalid")} /></Screen>;
  const d = draw.data;
  const title = `${denominationLabel(code!, t)} · ${t("draw.number", { number: drawNumber })}`;

  return (
    <Screen onRefresh={() => void draw.refresh()} refreshing={draw.refreshing}>
      <Stack.Screen options={{ title }} />
      {draw.stale && draw.error ? <StaleNotice savedAt={draw.savedAt} /> : null}
      {draw.status === "loading" ? (
        <LoadingView />
      ) : draw.status === "error" || !d ? (
        <ErrorView error={draw.error} onRetry={draw.refresh} />
      ) : (
        <>
          <Card>
            <View className="gap-2">
              <Text variant="title" accessibilityRole="header">
                {denominationLabel(d.denominationCode, t)}
              </Text>
              <Row gap={8} wrap>
                <Text tone="textMuted">{formatDate(d.drawDate, locale)}</Text>
                {d.city ? <Text tone="textMuted">· {d.city}</Text> : null}
              </Row>
              <Row gap={8} wrap>
                <DrawStatusBadge status={d.status} />
                <Badge
                  tone="neutral"
                  icon="list-outline"
                  label={t(`completeness.${d.completeness}`)}
                />
              </Row>
              {d.notice ? (
                <Notice tone="warning">{d.notice}</Notice>
              ) : null}
            </View>
          </Card>

          {d.prizes.length > 0 ? (
            <Card title={t("draw.prizes")} padded={false}>
              <View accessibilityRole="list">
                <Rows>
                  {d.prizes.map((p) => (
                    <RowItem
                      key={p.tier}
                      accessible
                      accessibilityLabel={`${t(`tier.${p.tier}`)}, ${formatPkr(p.amountPkr, locale)}, ${t("draw.winners", { count: p.winnersCount })}`}
                    >
                      <View className="flex-1">
                        <Text variant="label">{t(`tier.${p.tier}`)}</Text>
                        <Text variant="caption" tone="textMuted">
                          {t("draw.winners", { count: p.winnersCount })}
                          {p.inferred ? ` · ${t("draw.inferred")}` : ""}
                        </Text>
                      </View>
                      <Num variant="heading" tone="success">
                        {groupDigits(p.amountPkr)}
                      </Num>
                    </RowItem>
                  ))}
                </Rows>
              </View>
              <View className="px-4 pb-4 pt-2">
                <Text variant="caption" tone="textMuted">
                  {t("draw.amountsInPkr")}
                </Text>
              </View>
            </Card>
          ) : null}

          <Card title={t("tier.1")}>
            <NumberGrid numbers={d.tier1} large emptyLabel={t("draw.notPublished")} />
          </Card>
          <Card title={t("tier.2")}>
            <NumberGrid numbers={d.tier2} emptyLabel={t("draw.notPublished")} />
          </Card>

          <Card title={t("draw.findTitle")}>
            <View className="gap-3">
              <Field
                label={t("draw.findLabel")}
                value={query}
                onChangeText={(v) => setQuery(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                ltr
                error={query.length > 0 && query.length < 6 ? t("draw.sixDigits") : null}
                onSubmitEditing={() => void findNumber()}
                returnKeyType="search"
              />
              <Button label={t("draw.find")} icon="search" onPress={() => void findNumber()} loading={lookup.busy} disabled={!isBondNumber(query)} />
              {lookup.message ? (
                <Text tone={lookup.win ? "success" : "textMuted"} accessibilityLiveRegion="polite">
                  {lookup.message}
                </Text>
              ) : null}
            </View>
          </Card>

          {d.completeness === "full" ? (
            <Card title={t("tier.3")}>
              <View className="gap-3">
                {third ? (
                  <>
                    <Text variant="caption" tone="textMuted">
                      {t("draw.showing", { shown: groupDigits(third.numbers.length), total: groupDigits(third.total) })}
                    </Text>
                    <NumberGrid numbers={third.numbers} emptyLabel={t("draw.notPublished")} />
                  </>
                ) : null}
                {thirdError ? <ErrorView compact error={thirdError} onRetry={() => void loadThird()} /> : null}
                {!third || third.numbers.length < third.total ? (
                  <Button
                    label={third ? t("draw.loadMore") : t("draw.showThird")}
                    variant="secondary"
                    loading={thirdBusy}
                    onPress={() => void loadThird()}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}

          {d.sources.length > 0 ? (
            <Card title={t("draw.sources")}>
              <View className="gap-3">
                {d.sources.map((s) => (
                  <View key={s.sha256} className="gap-0.5">
                    <Row gap={8} wrap>
                      <Text variant="label">{t(`sources.${s.source}`) === `sources.${s.source}` ? s.source : t(`sources.${s.source}`)}</Text>
                      <Badge tone={s.role === "conflicting" ? "warning" : "neutral"} label={t(`sourceRole.${s.role}`)} />
                    </Row>
                    <Text variant="caption" tone="textMuted">
                      {t("draw.fetched", { date: formatDateTime(s.fetchedAt, locale) })}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function NumberGrid({ numbers, large = false, emptyLabel }: { numbers: string[]; large?: boolean; emptyLabel: string }) {
  if (numbers.length === 0) return <Text tone="textMuted">{emptyLabel}</Text>;
  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="list">
      {numbers.map((n) => (
        <View
          key={n}
          accessible
          accessibilityLabel={n.split("").join(" ")}
          className={cn("rounded-md px-3 py-2", large ? "bg-gold-container" : "bg-surface-muted")}
        >
          <Num variant={large ? "title" : "body"} mono tone={large ? "gold" : "text"}>
            {n}
          </Num>
        </View>
      ))}
    </View>
  );
}


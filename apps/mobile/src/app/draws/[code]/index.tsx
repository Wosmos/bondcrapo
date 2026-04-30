import { listDraws, type DrawSummary } from "@bondcheck/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { readCache, writeCache } from "@/lib/cache";
import { denominationLabel, findDenomination } from "@/lib/denominations";
import { formatDate } from "@/lib/format";
import { Button, Card, DrawStatusBadge, EmptyView, ErrorView, ListRow, LoadingView, Num, Row, Screen, StaleNotice, Text } from "@/ui";

export default function DenominationDraws() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t, locale } = useI18n();
  const known = findDenomination(code ?? "");
  const [items, setItems] = useState<DrawSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const cacheKey = `bonds.draws.${code}`;

  const loadPage = useCallback(
    async (next: string | null) => {
      const { data, meta } = await api().call(listDraws, {
        query: { denomination: code, ...(next ? { cursor: next } : {}) },
      });
      const nextCursor = typeof meta?.nextCursor === "string" ? meta.nextCursor : null;
      return { data, nextCursor };
    },
    [code],
  );

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const page = await loadPage(null);
      setItems(page.data);
      setCursor(page.nextCursor);
      setStatus("ready");
      setSavedAt(null);
      await writeCache(cacheKey, page.data);
    } catch (e) {
      setError(e);
      setStatus((s) => (s === "ready" ? s : "error"));
    }
  }, [cacheKey, loadPage]);

  useEffect(() => {
    void (async () => {
      const cached = await readCache<DrawSummary[]>(cacheKey);
      if (cached) {
        setItems(cached.value);
        setSavedAt(cached.savedAt);
        setStatus("ready");
      }
      await refresh();
    })();
  }, [cacheKey, refresh]);

  const loadMore = async () => {
    if (!cursor) return;
    setMore(true);
    try {
      const page = await loadPage(cursor);
      setItems((prev) => [...prev, ...page.data]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e);
    } finally {
      setMore(false);
    }
  };

  if (!known) {
    return (
      <Screen>
        <EmptyView icon="help-circle-outline" title={t("draws.unknownDenomination")} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void refresh()}>
      <Stack.Screen options={{ title: denominationLabel(known.code, t) }} />
      {savedAt && error ? <StaleNotice savedAt={savedAt} /> : null}
      {status === "loading" ? (
        <LoadingView />
      ) : status === "error" ? (
        <ErrorView error={error} onRetry={() => void refresh()} />
      ) : items.length === 0 ? (
        <EmptyView icon="trophy-outline" title={t("draws.emptyTitle")} body={t("draws.emptyBody")} />
      ) : (
        <Card padded={false}>
          {items.map((d, i) => (
            <ListRow
              key={d.id}
              title={formatDate(d.drawDate, locale)}
              subtitle={
                <Row gap={6} wrap>
                  {d.drawNumber !== null ? (
                    <Num variant="caption" tone="textMuted">
                      {t("draw.number", { number: d.drawNumber })}
                    </Num>
                  ) : null}
                  {d.city ? (
                    <Text variant="caption" tone="textMuted">
                      {d.city}
                    </Text>
                  ) : null}
                </Row>
              }
              trailing={<DrawStatusBadge status={d.status} />}
              onPress={
                d.drawNumber !== null
                  ? () => router.push({ pathname: "/draws/[code]/[number]", params: { code: known.code, number: String(d.drawNumber) } })
                  : undefined
              }
              last={i === items.length - 1}
            />
          ))}
        </Card>
      )}
      {cursor ? (
        <View style={{ alignItems: "center" }}>
          <Button label={t("draws.loadMore")} variant="secondary" loading={more} onPress={() => void loadMore()} />
        </View>
      ) : null}
    </Screen>
  );
}

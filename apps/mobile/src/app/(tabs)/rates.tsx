import { fxPkr, localRates } from "@bondcheck/shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, groupDigits } from "@/lib/format";
import { fxTable, rateTable, readAttribution } from "@/lib/rates";
import { useTheme } from "@/theme";
import { Badge, Card, EmptyView, ErrorView, LoadingView, Num, Screen, Segmented, StaleNotice, Text } from "@/ui";

export default function RatesScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"gold" | "currency">("gold");
  return (
    <Screen>
      <Segmented
        label={t("rates.viewLabel")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "gold", label: t("rates.gold") },
          { value: "currency", label: t("rates.currency") },
        ]}
      />
      {tab === "gold" ? <GoldRates /> : <CurrencyRates />}
    </Screen>
  );
}

function KindBadge({ kind }: { kind: "reported" | "derived" }) {
  const { t } = useI18n();
  return kind === "reported" ? (
    <Badge tone="success" icon="checkmark-circle-outline" label={t("rates.reported")} />
  ) : (
    <Badge tone="info" icon="calculator-outline" label={t("rates.estimated")} />
  );
}

function GoldRates() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const res = useResource("markets.local.PK", async () => {
    const { data, meta } = await api().call(localRates, { query: { country: "PK" } });
    return { rates: data, attribution: readAttribution(meta) };
  });
  if (res.status === "loading") return <LoadingView />;
  if (res.status === "error" || !res.data) return <ErrorView error={res.error} onRetry={res.refresh} />;
  const rows = rateTable(res.data.rates);
  if (rows.length === 0) return <EmptyView icon="trending-up-outline" title={t("rates.emptyTitle")} body={t("rates.emptyBody")} />;
  const first = res.data.rates[0];

  return (
    <>
      {res.stale && res.error ? <StaleNotice savedAt={res.savedAt} /> : null}
      <Card title={t("rates.goldTitle")} padded={false}>
        <View style={[styles.headRow, { borderBottomColor: colors.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text variant="caption" tone="textMuted" style={styles.colLabel}>
            {t("rates.purity")}
          </Text>
          <Text variant="caption" tone="textMuted" style={styles.colValue}>
            {t("rates.perTola")}
          </Text>
          <Text variant="caption" tone="textMuted" style={styles.colValue}>
            {t("rates.per10g")}
          </Text>
        </View>
        {rows.map((r, i) => {
          const name = r.metal === "XAU" ? t("rates.karat", { karat: r.karat }) : t(`metals.${r.metal}`);
          const kind = r.perTola?.kind ?? r.per10g?.kind ?? "derived";
          const tola = r.perTola ? groupDigits(r.perTola.price) : "-";
          const tenG = r.per10g ? groupDigits(r.per10g.price) : "-";
          return (
            <View
              key={`${r.metal}-${r.karat}`}
              accessible
              accessibilityLabel={t("rates.rowA11y", { name, tola, tenG, kind: kind === "reported" ? t("rates.reported") : t("rates.estimated") })}
              style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            >
              <View style={[styles.colLabel, { gap: 4 }]}>
                <Text variant="label">{name}</Text>
                <KindBadge kind={kind} />
              </View>
              <Num variant="body" style={styles.colValue}>
                {tola}
              </Num>
              <Num variant="body" style={styles.colValue}>
                {tenG}
              </Num>
            </View>
          );
        })}
        <View style={{ padding: 16, gap: 4 }}>
          <Text variant="caption" tone="textMuted">
            {t("rates.pkrNote")}
            {first ? ` ${t("rates.asOf", { date: formatDate(first.date, locale) })}` : ""}
          </Text>
          <Text variant="caption" tone="textMuted">
            {t("rates.estimatedNote")}
          </Text>
        </View>
      </Card>
      <Attribution items={res.data.attribution} />
    </>
  );
}

function CurrencyRates() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const res = useResource("markets.fx.pkr", async () => {
    const { data, meta } = await api().call(fxPkr, { query: {} });
    return { rates: data, attribution: readAttribution(meta) };
  });
  if (res.status === "loading") return <LoadingView />;
  if (res.status === "error" || !res.data) return <ErrorView error={res.error} onRetry={res.refresh} />;
  const rows = fxTable(res.data.rates);
  if (rows.length === 0) return <EmptyView icon="cash-outline" title={t("rates.emptyTitle")} body={t("rates.emptyBody")} />;
  const latest = res.data.rates.reduce((acc, r) => (r.observedAt > acc ? r.observedAt : acc), "");

  return (
    <>
      {res.stale && res.error ? <StaleNotice savedAt={res.savedAt} /> : null}
      <Card title={t("rates.currencyTitle")} padded={false}>
        <View style={[styles.headRow, { borderBottomColor: colors.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text variant="caption" tone="textMuted" style={styles.colLabel}>
            {t("rates.currencyCol")}
          </Text>
          <Text variant="caption" tone="textMuted" style={styles.colValue}>
            {t("rates.openMarket")}
          </Text>
          <Text variant="caption" tone="textMuted" style={styles.colValue}>
            {t("rates.interbank")}
          </Text>
        </View>
        {rows.map((r, i) => {
          const open = r.openMarket ? `${groupDigits(r.openMarket.buy, 2)} / ${groupDigits(r.openMarket.sell, 2)}` : "-";
          const inter = r.interbank ? groupDigits((r.interbank.buy + r.interbank.sell) / 2, 2) : "-";
          return (
            <View
              key={r.currency}
              accessible
              accessibilityLabel={t("rates.fxA11y", { currency: r.currency, open, inter })}
              style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            >
              <Num variant="label" style={styles.colLabel}>
                {r.currency}
              </Num>
              <Num variant="body" style={styles.colValue}>
                {open}
              </Num>
              <Num variant="body" style={styles.colValue}>
                {inter}
              </Num>
            </View>
          );
        })}
        <View style={{ padding: 16, gap: 4 }}>
          <Text variant="caption" tone="textMuted">
            {t("rates.fxNote")}
          </Text>
          {latest ? (
            <Text variant="caption" tone="textMuted">
              {t("rates.updated", { date: formatDateTime(latest, locale) })}
            </Text>
          ) : null}
        </View>
      </Card>
      <Attribution items={res.data.attribution} />
    </>
  );
}

function Attribution({ items }: { items: { name: string; text: string }[] }) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 4, paddingHorizontal: 4 }}>
      <Text variant="caption" tone="textMuted">
        {t("rates.sources")}
      </Text>
      {items.map((a) => (
        <Text key={a.name} variant="caption" tone="textMuted">
          {a.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 8, minHeight: 60 },
  colLabel: { flex: 1.2 },
  colValue: { flex: 1, textAlign: "right" },
});

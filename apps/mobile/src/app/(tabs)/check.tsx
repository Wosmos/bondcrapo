import { checkBonds, DENOMINATIONS, MAX_CHECK_NUMBERS, putWalletBonds } from "@bondcheck/shared";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Linking, View } from "react-native";
import { useI18n } from "@/i18n";
import { api, classifyError } from "@/lib/api";
import { expandInput, parseBondInput, toCheckRequest } from "@/lib/bond-input";
import { denominationLabel } from "@/lib/denominations";
import { formatDate, formatPkr, groupDigits } from "@/lib/format";
import { scanBondNumbers, type ScanResult } from "@/lib/scan";
import { useWallet } from "@/lib/wallet";
import { Badge, Button, Card, ChipGroup, ErrorView, Field, Num, Panel, Row, Screen, Text } from "@/ui";

type CheckResult = { checked: number; wins: { bondNumber: string; denominationCode: string; drawId: number; drawNumber: number | null; drawDate: string; tier: number; amountPkr: number }[] };

export default function CheckScreen() {
  const { t, locale } = useI18n();
  const wallet = useWallet();
  const params = useLocalSearchParams<{ scan?: string }>();
  const [text, setText] = useState("");
  const [denomination, setDenomination] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [scanNote, setScanNote] = useState<{ tone: "info" | "warning"; text: string; settings?: boolean } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const scannedFromParam = useRef(false);

  const parsed = useMemo(() => parseBondInput(text), [text]);
  const tooMany = parsed.total > MAX_CHECK_NUMBERS;

  const options = useMemo(
    () => [
      { value: "all", label: t("check.allDenominations") },
      ...DENOMINATIONS.map((d) => ({ value: d.code as string, label: denominationLabel(d.code, t) })),
    ],
    [t],
  );

  const applyScan = (r: ScanResult) => {
    switch (r.kind) {
      case "ok":
        if (r.numbers.length === 0) {
          setScanNote({ tone: "warning", text: t("check.scanNone") });
        } else {
          setText((prev) => [prev.trim(), r.numbers.join("\n")].filter(Boolean).join("\n"));
          setScanNote({ tone: "info", text: t("check.scanFound", { count: r.numbers.length }) });
          AccessibilityInfo.announceForAccessibility(t("check.scanFound", { count: r.numbers.length }));
        }
        break;
      case "permissionDenied":
        setScanNote({ tone: "warning", text: t("check.cameraDenied"), settings: !r.canAskAgain });
        break;
      case "unsupported":
        setScanNote({ tone: "warning", text: t("check.scanUnsupported") });
        break;
      case "failed":
        setScanNote({ tone: "warning", text: t("check.scanFailed") });
        break;
      case "cancelled":
        break;
    }
  };

  const scan = async (source: "camera" | "library") => {
    setScanNote(null);
    applyScan(await scanBondNumbers(source));
  };

  useEffect(() => {
    if (params.scan === "1" && !scannedFromParam.current) {
      scannedFromParam.current = true;
      void scan("camera");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.scan]);

  const runCheck = async () => {
    if (parsed.total === 0 || tooMany) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setSaved(null);
    try {
      const body = toCheckRequest(parsed, denomination === "all" ? undefined : denomination);
      const { data } = await api().call(checkBonds, { body });
      setResult(data);
      const message =
        data.wins.length > 0
          ? t("check.summaryWins", { count: data.wins.length, checked: data.checked })
          : t("check.summaryNone", { checked: data.checked });
      AccessibilityInfo.announceForAccessibility(message);
      if (data.wins.length > 0) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const saveToWallet = async () => {
    if (denomination === "all") return;
    setBusy(true);
    try {
      const numbers = expandInput(parsed).slice(0, 5000);
      const { data } = await api().call(putWalletBonds, {
        body: { bonds: numbers.map((bondNumber) => ({ denominationCode: denomination, bondNumber })) },
      });
      setSaved(t("check.savedToWallet", { count: data.added }));
    } catch (e) {
      setSaved(t(`errors.${classifyError(e)}.title`));
    } finally {
      setBusy(false);
    }
  };

  const fieldError = tooMany
    ? t("check.tooMany", { max: groupDigits(MAX_CHECK_NUMBERS) })
    : parsed.invalid.length > 0
      ? t("check.invalidTokens", { tokens: parsed.invalid.slice(0, 3).join(", ") })
      : null;

  return (
    <Screen>
      <Card>
        <View className="gap-4">
          <Text variant="title" accessibilityRole="header">
            {t("check.title")}
          </Text>
          <Field
            label={t("check.numbersLabel")}
            helper={t("check.numbersHelp")}
            error={fieldError}
            value={text}
            onChangeText={setText}
            multiline
            ltr
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            autoCapitalize="none"
            placeholder={"123456\n654321\n100100-100150"}
          />
          <Row gap={8} wrap>
            <Button label={t("check.scan")} icon="camera-outline" variant="secondary" onPress={() => void scan("camera")} />
            <Button label={t("check.fromPhoto")} icon="image-outline" variant="secondary" onPress={() => void scan("library")} />
          </Row>
          {scanNote ? (
            <View className="gap-2" accessibilityLiveRegion="polite">
              <Badge tone={scanNote.tone} icon={scanNote.tone === "info" ? "scan-outline" : "alert-circle-outline"} label={scanNote.text} />
              {scanNote.settings ? (
                <Button label={t("check.openSettings")} variant="ghost" onPress={() => void Linking.openSettings()} />
              ) : null}
            </View>
          ) : null}
          <ChipGroup label={t("check.denominationLabel")} options={options} value={denomination} onChange={setDenomination} />
          <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
            {parsed.total > 0 ? t("check.ready", { count: parsed.total }) : t("check.empty")}
          </Text>
          <Button
            label={t("check.submit")}
            icon="search"
            size="lg"
            block
            loading={busy}
            disabled={parsed.total === 0 || tooMany}
            onPress={() => void runCheck()}
          />
        </View>
      </Card>

      {error ? (
        <Card>
          <ErrorView compact error={error} onRetry={() => void runCheck()} />
        </Card>
      ) : null}

      {result ? (
        <Card title={t("check.resultsTitle")}>
          <View className="gap-3">
            <Panel accessibilityLiveRegion="polite" className={result.wins.length > 0 ? "bg-gold-container" : undefined}>
              <Text variant="heading" tone={result.wins.length > 0 ? "gold" : "text"}>
                {result.wins.length > 0
                  ? t("check.summaryWins", { count: result.wins.length, checked: result.checked })
                  : t("check.summaryNone", { checked: result.checked })}
              </Text>
              <Text variant="caption" tone="textMuted">
                {t("check.coverageNote")}
              </Text>
            </Panel>
            {result.wins.map((w) => (
              <View
                key={`${w.drawId}-${w.bondNumber}`}
                accessible
                accessibilityLabel={t("check.winA11y", {
                  number: w.bondNumber.split("").join(" "),
                  tier: t(`tier.${w.tier}`),
                  amount: formatPkr(w.amountPkr, locale),
                  date: formatDate(w.drawDate, locale),
                })}
                className="gap-1.5 rounded-md border border-border p-3"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Num variant="title" mono>
                    {w.bondNumber}
                  </Num>
                  <Badge tone="gold" icon="trophy" label={t(`tier.${w.tier}`)} />
                </View>
                <Text variant="label" tone="success">
                  {formatPkr(w.amountPkr, locale)}
                </Text>
                <Text variant="caption" tone="textMuted">
                  {denominationLabel(w.denominationCode, t)} · {formatDate(w.drawDate, locale)}
                </Text>
                {w.drawNumber !== null ? (
                  <Button
                    label={t("check.viewDraw")}
                    variant="ghost"
                    onPress={() =>
                      router.push({ pathname: "/draws/[code]/[number]", params: { code: w.denominationCode, number: String(w.drawNumber) } })
                    }
                  />
                ) : null}
              </View>
            ))}
            {wallet.state.status === "ready" ? (
              denomination === "all" ? (
                <Text variant="caption" tone="textMuted">
                  {t("check.pickDenominationToSave")}
                </Text>
              ) : (
                <Button label={t("check.saveToWallet")} icon="wallet-outline" variant="secondary" onPress={() => void saveToWallet()} loading={busy} />
              )
            ) : null}
            {saved ? (
              <Text variant="caption" tone="success" accessibilityLiveRegion="polite">
                {saved}
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

import { DENOMINATIONS, putWalletBonds } from "@bondcheck/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { expandInput, parseBondInput } from "@/lib/bond-input";
import { denominationLabel } from "@/lib/denominations";
import { groupDigits } from "@/lib/format";
import { scanBondNumbers } from "@/lib/scan";
import { Badge, Button, Card, ChipGroup, ErrorView, Field, Row, Screen, Text } from "@/ui";

const MAX_ADD = 5000;

export default function AddBonds() {
  const { t } = useI18n();
  const [denomination, setDenomination] = useState<string>("750");
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);

  const parsed = useMemo(() => parseBondInput(text), [text]);
  const numbers = useMemo(() => (parsed.total <= MAX_ADD ? expandInput(parsed) : []), [parsed]);
  const tooMany = parsed.total > MAX_ADD;

  const options = DENOMINATIONS.map((d) => ({ value: d.code as string, label: denominationLabel(d.code, t) }));

  const scan = async () => {
    const r = await scanBondNumbers("camera");
    if (r.kind === "ok" && r.numbers.length > 0) {
      setText((prev) => [prev.trim(), r.numbers.join("\n")].filter(Boolean).join("\n"));
      setNote(t("check.scanFound", { count: r.numbers.length }));
    } else if (r.kind === "ok") setNote(t("check.scanNone"));
    else if (r.kind === "permissionDenied") setNote(t("check.cameraDenied"));
    else if (r.kind === "unsupported") setNote(t("check.scanUnsupported"));
    else if (r.kind === "failed") setNote(t("check.scanFailed"));
  };

  const save = async () => {
    if (numbers.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = label.trim();
      await api().call(putWalletBonds, {
        body: {
          bonds: numbers.map((bondNumber) => ({
            denominationCode: denomination,
            bondNumber,
            ...(trimmed ? { label: trimmed.slice(0, 80) } : {}),
          })),
        },
      });
      router.back();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <View className="gap-4">
          <Text tone="textMuted">{t("walletAdd.intro")}</Text>
          <ChipGroup label={t("check.denominationLabel")} options={options} value={denomination} onChange={setDenomination} />
          <Field
            label={t("check.numbersLabel")}
            helper={t("check.numbersHelp")}
            error={
              tooMany
                ? t("check.tooMany", { max: groupDigits(MAX_ADD) })
                : parsed.invalid.length
                  ? t("check.invalidTokens", { tokens: parsed.invalid.slice(0, 3).join(", ") })
                  : null
            }
            value={text}
            onChangeText={setText}
            multiline
            ltr
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
          />
          <Row gap={8} wrap>
            <Button label={t("check.scan")} icon="camera-outline" variant="secondary" onPress={() => void scan()} />
          </Row>
          {note ? <Badge tone="info" icon="scan-outline" label={note} /> : null}
          <Field label={t("walletAdd.labelField")} helper={t("walletAdd.labelHelp")} value={label} onChangeText={setLabel} maxLength={80} />
          {error ? <ErrorView compact error={error} /> : null}
          <Button
            label={numbers.length > 0 ? t("walletAdd.saveCount", { count: numbers.length }) : t("walletAdd.save")}
            icon="checkmark"
            size="lg"
            block
            loading={busy}
            disabled={numbers.length === 0}
            onPress={() => void save()}
          />
        </View>
      </Card>
    </Screen>
  );
}

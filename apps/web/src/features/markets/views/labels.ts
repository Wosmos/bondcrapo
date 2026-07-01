import "server-only";
import { getTranslations } from "next-intl/server";
import type { ChartLabels } from "../components/PriceChart";

export type MarketsT = Awaited<ReturnType<typeof getTranslations>>;

export async function marketsT(locale: string): Promise<MarketsT> {
  return getTranslations({ locale, namespace: "markets" });
}

/** Chart strings resolved on the server and handed to the client island as plain props. */
export function chartLabels(t: MarketsT): ChartLabels {
  return {
    rangeGroup: t("chart.rangeGroup"),
    ranges: { "1m": t("chart.ranges.1m"), "6m": t("chart.ranges.6m"), "1y": t("chart.ranges.1y"), "5y": t("chart.ranges.5y"), max: t("chart.ranges.max") },
    slider: t.raw("chart.slider") as string,
    keyboardHint: t("chart.keyboardHint"),
    loading: t("chart.loading"),
    error: t("chart.error"),
    retry: t("chart.retry"),
    empty: t("chart.empty"),
    showTable: t("chart.showTable"),
    tableCaption: t("chart.tableCaption"),
    tableSampled: t.raw("chart.tableSampled") as string,
    date: t("chart.date"),
    value: t("chart.value"),
    summary: t.raw("chart.summary") as string,
    trendUp: t("chart.trendUp"),
    trendDown: t("chart.trendDown"),
    trendFlat: t("chart.trendFlat"),
    custom: { label: t("chart.custom.label"), apply: t("chart.custom.apply"), clear: t("chart.custom.clear"), window: t.raw("chart.custom.window") as string },
  };
}

export function subnavLabels(t: MarketsT) {
  return { label: t("subnav.label"), gold: t("subnav.gold"), silver: t("subnav.silver"), metals: t("subnav.metals"), currency: t("subnav.currency") };
}

export function kindLabels(t: MarketsT) {
  return { reported: t("common.reported"), estimated: t("common.estimated") };
}

export function changeLabels(t: MarketsT) {
  return { up: t("common.up"), down: t("common.down"), unchanged: t("common.unchanged") };
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DENOMINATIONS } from "@bondcheck/shared/constants";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { formatAmount, formatDate } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { paths } from "@/i18n/paths";
import { LOADING_BOARD, loadBoard, type BoardData, type PkrRate, type Tile } from "./live-data";

const ERROR_BOARD: BoardData = { latest: { state: "error" }, gold: { state: "error" }, usd: { state: "error" } };
const FACE = new Map(DENOMINATIONS.map((d) => [d.code as string, d]));

const STATUS_TONE = { verified: "success", published: "info", disputed: "warning", scheduled: "neutral" } as const;

/** Raw message templates from `common.home.board`, passed in by the server page. */
export type BoardLabels = Record<string, string>;

/**
 * Fills `{name}` placeholders. The board takes its strings as props so the page does not ship
 * the ICU message runtime to the browser for one island.
 */
export function fillTemplate(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? String(values[key]) : m));
}

/**
 * "Today at a glance": latest draws, 24K gold per tola and USD/PKR. Loads when the board comes
 * near the viewport, so the contracts and their validator never compete with the first paint.
 */
export function LiveBoard({ locale, labels }: { locale: string; labels: BoardLabels }) {
  const t: T = (key, values) => fillTemplate(labels[key] ?? key, values);
  const rootRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<BoardData>(LOADING_BOARD);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const run = () => {
      loadBoard()
        .then((b) => alive && setBoard(b))
        .catch(() => alive && setBoard(ERROR_BOARD));
    };
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const handle = window.setTimeout(run, 300);
      return () => {
        alive = false;
        window.clearTimeout(handle);
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          run();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [attempt]);

  const retry = () => {
    setBoard(LOADING_BOARD);
    setAttempt((a) => a + 1);
  };

  const money = (value: number, digits = 0) => t("rs", { value: formatAmount(locale, value, digits) });
  const denomination = (code: string) => {
    const info = FACE.get(code);
    const value = formatAmount(locale, info?.faceValue ?? Number.parseInt(code, 10));
    return info?.kind === "premium_registered" ? t("premium", { value }) : t("rs", { value });
  };
  const busy = board.latest.state === "loading" || board.gold.state === "loading" || board.usd.state === "loading";

  return (
    <div ref={rootRef} aria-busy={busy} className="grid items-start gap-4 md:grid-cols-5">
      <Panel
        className="md:col-span-3"
        title={t("latest")}
        icon="bonds"
        link={{ href: paths.bonds, label: t("allDraws") }}
      >
        <TileBody tile={board.latest} t={t} onRetry={retry} rows={5}>
          {(draws) => (
            <ul className="divide-y divide-line">
              {draws.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.drawNumber ? paths.draw(d.denominationCode, d.drawNumber) : paths.denomination(d.denominationCode)}
                    className="group flex min-h-14 items-center gap-3 py-2.5 hover:bg-surface-2/50"
                  >
                    <span className="w-28 shrink-0 font-semibold text-ink">{denomination(d.denominationCode)}</span>
                    <span className="min-w-0 flex-1 text-sm text-ink-2">
                      {d.drawNumber ? (
                        <span className="block">
                          {t("draw", { number: String(d.drawNumber) })}
                        </span>
                      ) : null}
                      <span className="block">
                        <bdi>{formatDate(locale, d.drawDate)}</bdi>
                        {d.city ? <span> · {d.city}</span> : null}
                      </span>
                    </span>
                    <Badge tone={STATUS_TONE[d.status]}>{t(`status.${d.status}`)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TileBody>
      </Panel>

      <div className="grid gap-4 md:col-span-2">
        <Panel title={t("gold")} icon="markets" link={{ href: paths.gold, label: t("goldLink") }}>
          <TileBody tile={board.gold} t={t} onRetry={retry} rows={2}>
            {(rate) => (
              <div>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="num text-3xl font-semibold tracking-tight text-ink">{money(rate.price)}</span>
                  <span className="text-sm text-ink-2">{t("perTola")}</span>
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
                  <Badge tone={rate.kind === "reported" ? "info" : "warning"}>
                    {rate.kind === "reported" ? t("reported") : t("estimated")}
                  </Badge>
                  <span>{t("asOf", { date: formatDate(locale, rate.date) })}</span>
                </p>
                <p className="mt-1 text-xs text-ink-2">{t("source", { source: rate.source })}</p>
              </div>
            )}
          </TileBody>
        </Panel>

        <Panel title={t("usd")} icon="markets" link={{ href: paths.currency, label: t("currencyLink") }}>
          <TileBody tile={board.usd} t={t} onRetry={retry} rows={2}>
            {({ open, interbank }) => (
              <div>
<table className="w-full text-sm">
                  <caption className="sr-only">{t("usd")}</caption>
                  <thead>
                    <tr className="text-xs text-ink-2">
                      <td />
                      <th scope="col" className="pb-1 text-end font-medium">
                        {t("buy")}
                      </th>
                      <th scope="col" className="pb-1 text-end font-medium">
                        {t("sell")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {open ? <FxRow label={t("openMarket")} rate={open} locale={locale} /> : null}
                    {interbank ? <FxRow label={t("interbank")} rate={interbank} locale={locale} /> : null}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-ink-2">
                  {t("asOf", { date: formatDate(locale, (open ?? interbank)!.date) })}
                  {" · "}
                  {t("source", { source: [open?.source, interbank?.source].filter(Boolean).join(", ") })}
                </p>
              </div>
            )}
          </TileBody>
        </Panel>
      </div>
    </div>
  );
}

type T = (key: string, values?: Record<string, string | number>) => string;

function FxRow({ label, rate, locale }: { label: string; rate: PkrRate; locale: string }) {
  return (
    <tr>
      <th scope="row" className="py-1 text-start font-medium text-ink">
        {label}
      </th>
      <td className="num py-1 ps-4 text-end text-base font-semibold text-ink">{formatAmount(locale, rate.buy, 2)}</td>
      <td className="num py-1 ps-4 text-end text-base font-semibold text-ink">{formatAmount(locale, rate.sell, 2)}</td>
    </tr>
  );
}

function Panel({
  title,
  icon,
  link,
  className = "",
  children,
}: {
  title: string;
  icon: string;
  link: { href: string; label: string };
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`flex flex-col rounded-3xl border border-line bg-surface p-5 shadow-card ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ink">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand/12 text-brand">
            <Icon name={icon} className="size-4.5" />
          </span>
          {title}
        </h3>
        <Link
          href={link.href}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          {link.label}
          <Icon name="arrow" className="size-4 rtl:-scale-x-100" />
        </Link>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function TileBody<D>({
  tile,
  t,
  onRetry,
  rows,
  children,
}: {
  tile: Tile<D>;
  t: T;
  onRetry: () => void;
  rows: number;
  children: (data: D) => ReactNode;
}) {
  if (tile.state === "ready") return <>{children(tile.data)}</>;
  if (tile.state === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton label={t("loading")} size="h-6 w-2/3" />
        {Array.from({ length: rows - 1 }, (_, i) => (
          <div key={i} aria-hidden="true" className="h-6 w-full animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }
  if (tile.state === "empty") return <p className="py-4 text-sm text-ink-2">{t("empty")}</p>;
  return (
    <div className="flex flex-col items-start gap-2 py-2">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Icon name="offline" className="size-5 text-ink-2" />
        {t("unavailable")}
      </p>
      <p className="text-xs text-ink-2">{t("unavailableHint")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-surface-2"
      >
        <Icon name="refresh" className="size-4" />
        {t("retry")}
      </button>
    </div>
  );
}

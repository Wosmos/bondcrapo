"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarDotsIcon } from "@phosphor-icons/react";
import { Button } from "@/components/shadcn/button";
import { Calendar } from "@/components/shadcn/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { cn } from "@/lib/utils";

export interface CustomWindow {
  /** Inclusive ISO dates (YYYY-MM-DD). */
  from: string;
  to: string;
}

export interface RangePickerLabels {
  label: string;
  apply: string;
  clear: string;
  /** "{from} to {to}" */
  window: string;
}

/** Earliest month the picker offers; older months have no daily series. */
const FIRST_MONTH = new Date(2000, 0, 1);

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};

/**
 * The "Custom" chip of the price chart: a shadcn popover with a two-month range calendar. Applying
 * hands back inclusive ISO dates; the chart fetches that window from the history API.
 */
export function RangePicker(props: {
  locale: string;
  pressed: boolean;
  value: CustomWindow | null;
  labels: RangePickerLabels;
  formatDate: (iso: string) => string;
  onApply: (window: CustomWindow) => void;
}) {
  const { locale, labels, value } = props;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    value ? { from: fromIso(value.from), to: fromIso(value.to) } : undefined,
  );
  const today = new Date();
  const ready = Boolean(draft?.from && draft?.to);
  const text = props.pressed && value
    ? labels.window.replace("{from}", props.formatDate(value.from)).replace("{to}", props.formatDate(value.to))
    : labels.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-pressed={props.pressed}
          className={cn(
            "inline-flex min-h-9 min-w-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            props.pressed ? "bg-brand text-on-brand" : "bg-surface-2 text-ink-2 hover:bg-line",
          )}
        >
          <CalendarDotsIcon aria-hidden="true" className="size-4" />
          <span className="tabular-nums">{text}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border-line bg-surface p-0 shadow-card">
        <Calendar
          mode="range"
          dir={locale === "ur" ? "rtl" : "ltr"}
          numberOfMonths={2}
          captionLayout="dropdown"
          startMonth={FIRST_MONTH}
          endMonth={today}
          defaultMonth={draft?.from ?? new Date(today.getFullYear(), today.getMonth() - 1, 1)}
          disabled={{ after: today }}
          selected={draft}
          onSelect={setDraft}
          formatters={{
            formatMonthDropdown: (d) => d.toLocaleString(locale, { month: "short", numberingSystem: "latn" }),
            // CLDR's narrow Urdu weekdays are Latin letters, so Urdu uses the short names.
            formatWeekdayName: (d) => d.toLocaleString(locale, { weekday: locale === "ur" ? "short" : "narrow" }),
          }}
        />
        <div className="flex items-center justify-end gap-2 border-t border-line p-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(undefined)} disabled={!draft?.from}>
            {labels.clear}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!ready}
            onClick={() => {
              if (!draft?.from || !draft.to) return;
              props.onApply({ from: iso(draft.from), to: iso(draft.to) });
              setOpen(false);
            }}
          >
            {labels.apply}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

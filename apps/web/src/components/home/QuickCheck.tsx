import { MagnifyingGlassIcon } from "@/components/ui/icons";
import { Input } from "@/components/shadcn/input";
import { SelectField } from "@/components/ui/SelectField";
import { DENOMINATIONS } from "@bondcheck/shared/constants";
import { formatAmount } from "@/i18n/format";
import { localePath } from "@/i18n/seo";
import { paths } from "@/i18n/paths";

export interface QuickCheckLabels {
  legend: string;
  number: string;
  numberHint: string;
  denomination: string;
  any: string;
  submit: string;
  rs: string;
  premium: string;
}

/**
 * Plain HTML GET form to the checker (`/prize-bonds/check?numbers=&denomination=`): works before
 * JavaScript loads and on the oldest phones. Native validation enforces six digits.
 */
export function QuickCheck({ locale, labels }: { locale: string; labels: QuickCheckLabels }) {
  const hintId = "quick-check-hint";
  const fill = (template: string, value: number) => template.replace("{value}", formatAmount(locale, value));
  return (
    <form
      action={localePath(locale, paths.check)}
      method="get"
      className="rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-ink">{labels.legend}</legend>
        <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="quick-check-number" className="mb-1 block text-xs font-medium text-ink-2">
              {labels.number}
            </label>
            <Input
              id="quick-check-number"
              name="numbers"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="search"
              required
              minLength={6}
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              dir="ltr"
              aria-describedby={hintId}
              className="h-14 rounded-2xl bg-paper px-4 font-mono text-2xl font-semibold tracking-[0.35em] md:text-2xl"
            />
            <p id={hintId} className="mt-1.5 text-xs text-ink-2">
              {labels.numberHint}
            </p>
          </div>
          <div>
            <label htmlFor="quick-check-denomination" className="mb-1 block text-xs font-medium text-ink-2">
              {labels.denomination}
            </label>
            {/* "any" is not a code, so the checker falls back to all denominations. */}
            <SelectField
              id="quick-check-denomination"
              name="denomination"
              defaultValue="any"
              className="h-14 rounded-2xl bg-paper font-medium data-[size=default]:h-14 sm:w-48"
              options={[
                { value: "any", label: labels.any },
                ...DENOMINATIONS.map((d) => ({ value: d.code, label: fill(d.kind === "premium_registered" ? labels.premium : labels.rs, d.faceValue) })),
              ]}
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-strong"
        >
          <MagnifyingGlassIcon aria-hidden="true" className="size-5" />
          {labels.submit}
        </button>
      </fieldset>
    </form>
  );
}

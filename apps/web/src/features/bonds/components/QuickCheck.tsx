import { Input } from "@/components/shadcn/input";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * A plain GET form to the checker: works without JavaScript and on the slowest phones. The
 * checker page reads `?numbers=` and runs the check.
 */
export function QuickCheck({ action }: { action: string }) {
  const t = useTranslations("bonds.hub");
  return (
    <section aria-labelledby="quick-check" className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <h2 id="quick-check" className="text-lg font-semibold text-ink">
        {t("quickCheck")}
      </h2>
      <form action={action} method="get" className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="quick-numbers" className="text-sm font-medium text-ink">
            {t("quickCheckLabel")}
          </label>
          <Input
            id="quick-numbers"
            placeholder="123456 654321"
            name="numbers"
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            required
            aria-describedby="quick-numbers-hint"
            className="h-11 bg-surface font-mono text-lg"
          />
          <p id="quick-numbers-hint" className="text-sm text-ink-2">
            {t("quickCheckHint")}
          </p>
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-6 font-medium text-on-brand hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:mb-7"
        >
          {t("quickCheckButton")}
        </button>
      </form>
      <p className="mt-2 text-sm">
        <Link href="/prize-bonds/check" className="underline underline-offset-4 hover:no-underline">
          {t("moreOptions")}
        </Link>
      </p>
    </section>
  );
}

import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { paths } from "@/i18n/paths";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "common.notFound" });
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <p aria-hidden="true" dir="ltr" className="font-mono text-6xl font-semibold tracking-[0.3em] text-gold-ink">
        404
      </p>
      <h1 className="font-display mt-6 text-3xl font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-ink-2">{t("body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-on-brand hover:bg-brand-strong">
          {t("home")}
        </Link>
        <Link href={paths.check} className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 font-semibold text-ink hover:bg-surface-2">
          {t("check")}
        </Link>
      </div>
    </div>
  );
}

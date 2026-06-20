import type { Metadata } from "next";

/** Canonical and hreflang alternates for a locale-less path (both locales are indexable, ADR 0005). */
export function alternates(locale: string, path: string): Metadata["alternates"] {
  return {
    canonical: `/${locale}${path}`,
    languages: { en: `/en${path}`, ur: `/ur${path}`, "x-default": `/en${path}` },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[], locale: string, base = process.env.APP_BASE_URL ?? "") {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${base}/${locale}${it.path}` })),
  };
}

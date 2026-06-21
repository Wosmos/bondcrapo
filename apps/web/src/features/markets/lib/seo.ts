import type { Metadata } from "next";

/**
 * Metadata for a market page in one locale: canonical plus hreflang alternates for en, ur and
 * x-default (PLAN section 8). `path` is locale-less, e.g. "/gold-rate".
 */
export function marketsMetadata(args: {
  locale: string;
  path: string;
  title: string;
  description: string;
  /** Canonical path when this page duplicates another (e.g. /gold-rate/pakistan -> /gold-rate). */
  canonicalPath?: string;
}): Metadata {
  const canonical = args.canonicalPath ?? args.path;
  return {
    title: args.title,
    description: args.description,
    alternates: {
      canonical: `/${args.locale}${canonical}`,
      languages: { en: `/en${canonical}`, ur: `/ur${canonical}`, "x-default": `/en${canonical}` },
    },
    openGraph: { title: args.title, description: args.description, type: "website", locale: args.locale === "ur" ? "ur_PK" : "en_PK" },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(locale: string, crumbs: Crumb[], base = process.env.APP_BASE_URL ?? "") {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${base}/${locale}${c.path}`,
    })),
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** A daily price series published on the page (Dataset helps search engines label the chart data). */
export function datasetJsonLd(args: { name: string; description: string; locale: string; path: string; sources: { name: string; url?: string }[]; temporalCoverage?: string }) {
  const base = process.env.APP_BASE_URL ?? "";
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: args.name,
    description: args.description,
    url: `${base}/${args.locale}${args.path}`,
    inLanguage: args.locale,
    isAccessibleForFree: true,
    ...(args.temporalCoverage ? { temporalCoverage: args.temporalCoverage } : {}),
    creator: args.sources.map((s) => ({ "@type": "Organization", name: s.name, ...(s.url ? { url: s.url } : {}) })),
  };
}

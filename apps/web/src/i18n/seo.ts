import type { Metadata } from "next";
import { routing, type AppLocale } from "./routing";

/**
 * Canonical, hreflang and Open Graph helpers shared by every lane (PLAN section 14, D2).
 *
 * Usage in a page:
 *   export async function generateMetadata({ params }) {
 *     const { locale } = await params;
 *     return pageMetadata({ locale, path: "/prize-bonds", title, description });
 *   }
 *
 * `path` is always locale-less and starts with "/". Absolute URLs use the site origin from
 * `APP_BASE_URL`, then Vercel's production host, then localhost for development.
 */

export const SITE_NAME = "BondCheck";

/** Site wide card from `app/opengraph-image.tsx` (root metadata files do not reach `[locale]`). */
export const DEFAULT_OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "BondCheck" };

const OG_LOCALE: Record<AppLocale, string> = { en: "en_PK", ur: "ur_PK" };

export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.APP_BASE_URL?.trim();
  if (explicit && /^https?:\/\//.test(explicit)) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

export function normalizePath(path: string): string {
  const clean = `/${path}`.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");
  if (/[?#]/.test(clean)) throw new Error(`path must not contain a query or hash: ${path}`);
  return clean;
}

/** "/en/prize-bonds" for ("en", "/prize-bonds"); "/ur" for ("ur", "/"). */
export function localePath(locale: string, path: string): string {
  const p = normalizePath(path);
  return p === "/" ? `/${locale}` : `/${locale}${p}`;
}

export function absoluteUrl(locale: string | null, path: string, origin = siteOrigin()): string {
  const p = locale ? localePath(locale, path) : normalizePath(path);
  return `${origin}${p === "/" ? "" : p}` || origin;
}

/** hreflang map for one page: every locale plus `x-default` (the unprefixed URL negotiates). */
export function languageAlternates(path: string, origin = siteOrigin()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of routing.locales) out[l] = absoluteUrl(l, path, origin);
  out["x-default"] = absoluteUrl(null, path, origin);
  return out;
}

export function alternatesFor(locale: string, path: string, origin = siteOrigin()): NonNullable<Metadata["alternates"]> {
  return { canonical: absoluteUrl(locale, path, origin), languages: languageAlternates(path, origin) };
}

export interface PageMetadataInput {
  locale: string;
  /** Locale-less path, e.g. "/gold-rate/uae". */
  path: string;
  title: string;
  description: string;
  /** Open Graph type, "website" by default. */
  type?: "website" | "article";
  /** Absolute or root-relative image URLs; the site OG image is used when omitted. */
  images?: string[];
  /** Set for thin or private pages (offline fallback, wallet). */
  noIndex?: boolean;
}

/** Complete metadata for a public page: title, description, canonical, hreflang, OG, Twitter. */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const origin = siteOrigin();
  const locale = (routing.locales as readonly string[]).includes(input.locale) ? (input.locale as AppLocale) : routing.defaultLocale;
  const url = absoluteUrl(locale, input.path, origin);
  return {
    title: input.title,
    description: input.description,
    alternates: alternatesFor(locale, input.path, origin),
    openGraph: {
      type: input.type ?? "website",
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      url,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images: input.images ?? [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: input.images ?? [DEFAULT_OG_IMAGE.url],
    },
    ...(input.noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Serialises JSON-LD safely for a `<script type="application/ld+json">` tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

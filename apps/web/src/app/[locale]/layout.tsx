import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import {
  ServiceWorkerRegistrar,
  shellNavItems,
  SiteFooter,
  SiteHeader,
  TabBar,
  THEME_SCRIPT,
} from "@/components/shell";
import { clientMessages } from "@/i18n/client-messages";
import { dirFor, routing } from "@/i18n/routing";
import { alternatesFor, DEFAULT_OG_IMAGE, SITE_NAME, siteOrigin } from "@/i18n/seo";
import { AnalyticsProvider } from "@/platform/analytics";
import "@/styles/globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

// Display face for Latin headings. Urdu headings use Nastaliq instead (see globals.css).
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Not preloaded: only Urdu text uses this family, so English pages never download it (ADR 0005).
const nastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq",
  subsets: ["arabic"],
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1511" },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: t("home.metaTitle"), template: `%s · ${t("appName")}` },
    description: t("home.metaDescription"),
    applicationName: SITE_NAME,
    alternates: alternatesFor(locale, "/"),
    // Six digit bond numbers must never turn into phone links.
    formatDetection: { telephone: false, address: false, email: false },
    appleWebApp: { capable: true, title: t("appName"), statusBarStyle: "default" },
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      locale: locale === "ur" ? "ur_PK" : "en_PK",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE.url] },
  };
}

/** Root layout (Lane D). `<html lang dir>` follows the locale; the shell comes from the nav registry. */
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  const items = await shellNavItems(locale);
  const messages = clientMessages(await getMessages({ locale }));

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${nastaliq.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          {t("a11y.skipToContent")}
        </a>
        <NextIntlClientProvider messages={messages}>
          <SiteHeader locale={locale} items={items} />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <SiteFooter locale={locale} items={items} />
          {/* Clears the fixed tab bar on phones. */}
          <div aria-hidden="true" className="h-20 md:hidden" />
          <TabBar items={items} label={t("a11y.tabNav")} />
        </NextIntlClientProvider>
        <ServiceWorkerRegistrar />
        <AnalyticsProvider />
      </body>
    </html>
  );
}

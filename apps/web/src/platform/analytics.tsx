import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * The only place `@vercel/*` analytics is imported (PLAN section 1 and 13). Rendered once by the
 * root layout. Page views and web vitals only: cookieless, no custom events, no fingerprinting.
 * Switch providers with ANALYTICS_PROVIDER=none (or, on Cloudflare later, a different adapter).
 */
export function AnalyticsProvider() {
  if (process.env.ANALYTICS_PROVIDER === "none") return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

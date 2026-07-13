import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@bondcheck/shared", "@bondcheck/db", "@bondcheck/ingest"],
  poweredByHeader: false,
  // Without Vercel's Skew Protection (Hobby plan), a tab opened before a deploy asks the new
  // deployment for code that no longer exists. With the deployment id, Next notices the mismatch
  // and does a full page load instead of hanging.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders(process.env.NODE_ENV !== "production") },
      // The service worker must always be revalidated so updates reach installed apps quickly.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default withNextIntl(nextConfig);

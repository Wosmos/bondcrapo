import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@bondcheck/shared", "@bondcheck/db", "@bondcheck/ingest"],
  // Security headers and CSP are added in the integration milestone (PLAN section 11).
};

export default withNextIntl(nextConfig);

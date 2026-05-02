import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Locale negotiation (PLAN section 8). Unprefixed paths redirect to `/en/...` or `/ur/...`:
 * an explicit earlier choice (the NEXT_LOCALE cookie set when someone uses the language
 * switcher) wins, then the browser's Accept-Language, then English. API routes, Next internals,
 * metadata image routes and files with an extension (sw.js, manifest, sitemaps) are excluded.
 */
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|opengraph-image|twitter-image|icon|apple-icon|.*\\..*).*)"],
};

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale negotiation: "/" redirects by Accept-Language, then cookie. API routes, Next internals
// and static files are excluded. Lane D owns this file from D1 onward.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

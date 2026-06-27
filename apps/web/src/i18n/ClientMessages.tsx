import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { CLIENT_PATHS, pickPaths } from "./client-messages";

/**
 * Sends only the message paths an interactive island needs to the browser, on top of the shell's
 * own client messages (a nested provider replaces, it does not merge). Server component.
 */
export async function ClientMessages({
  locale,
  paths,
  children,
}: {
  locale: string;
  paths: readonly string[];
  children: React.ReactNode;
}) {
  // An explicit locale keeps the page static (no request headers are read).
  const messages = pickPaths(await getMessages({ locale }), [...CLIENT_PATHS, ...paths]);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

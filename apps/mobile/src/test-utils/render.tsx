import { ApiClient } from "@bondcheck/shared";
import { render, type RenderOptions } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import type { AppLocale } from "@/i18n/types";
import { setApiClient } from "@/lib/api";
import { defaultSettings, SettingsProvider } from "@/lib/settings";
import { UpdateProvider } from "@/lib/update-context";
import { WalletProvider } from "@/lib/wallet";
import { readCredentials } from "@/lib/wallet-store";
import { ThemeProvider } from "@/theme";

export const TEST_SITE = "https://bondcheck.test";

export type Route = (req: { method: string; path: string; search: URLSearchParams; body: unknown; headers: Record<string, string> }) =>
  | { status?: number; body: unknown }
  | undefined;

/**
 * Installs an ApiClient whose fetch answers from `route` (recorded fixtures). Unknown requests
 * answer 501 like an unbuilt endpoint, so tests never touch the network.
 */
export function mockApi(route: Route) {
  const calls: { method: string; path: string; body: unknown; headers: Record<string, string> }[] = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/api\/v1/, "");
    calls.push({ method, path, body, headers });
    const hit = route({ method, path, search: url.searchParams, body, headers });
    const status = hit?.status ?? (hit ? 200 : 501);
    const payload = hit ? hit.body : { error: { code: "not_implemented", message: "not implemented" } };
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  });
  setApiClient(
    new ApiClient({
      baseUrl: TEST_SITE,
      fetch: fetchImpl as unknown as typeof fetch,
      getAuthorization: async () => {
        const c = await readCredentials();
        return c ? `Wallet ${c.walletId}.${c.token}` : undefined;
      },
    }),
  );
  return { calls, fetch: fetchImpl };
}

export function Providers({ children, locale = "en" }: { children: ReactNode; locale?: AppLocale }) {
  return (
    <SettingsProvider initial={{ ...defaultSettings(), locale }}>
      <I18nProvider locale={locale}>
        <ThemeProvider preference="light" locale={locale}>
          <WalletProvider>
            <UpdateProvider>{children}</UpdateProvider>
          </WalletProvider>
        </ThemeProvider>
      </I18nProvider>
    </SettingsProvider>
  );
}

export function renderScreen(ui: ReactElement, { locale = "en", ...options }: RenderOptions & { locale?: AppLocale } = {}) {
  return render(ui, { wrapper: ({ children }) => <Providers locale={locale}>{children}</Providers>, ...options });
}

export const ok = (data: unknown, meta?: Record<string, unknown>) => ({ body: meta ? { data, meta } : { data } });

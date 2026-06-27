import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { WalletShell } from "@/features/wallet/components/WalletShell";
import { ClientMessages } from "@/i18n/ClientMessages";

/** Personal pages: never indexed, never cached by search engines. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ClientMessages locale={locale} paths={["wallet"]}>
      <WalletShell>{children}</WalletShell>
    </ClientMessages>
  );
}

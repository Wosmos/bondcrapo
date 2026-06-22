import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { WalletShell } from "@/features/wallet/components/WalletShell";

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
  return <WalletShell>{children}</WalletShell>;
}

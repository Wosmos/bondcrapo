import { setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/i18n/ClientMessages";

/** The segment's error boundary (`error.tsx`) is a client component and needs its three strings. */
export default async function PrizeBondsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ClientMessages
      locale={locale}
      paths={["bonds.common.unavailableTitle", "bonds.common.unavailableBody", "bonds.common.retry"]}
    >
      {children}
    </ClientMessages>
  );
}

import { setRequestLocale } from "next-intl/server";
import { BondTabs } from "@/components/shell/BondTabs";
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
      <div className="flex flex-col gap-6">
        <BondTabs />
        {children}
      </div>
    </ClientMessages>
  );
}

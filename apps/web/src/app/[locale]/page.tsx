import { setRequestLocale } from "next-intl/server";
import { BondCheckApp } from "@/legacy/components/BondCheckApp";

// Temporary: the pre-rebuild checker keeps production working until Lane D ships the new home page.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BondCheckApp />;
}

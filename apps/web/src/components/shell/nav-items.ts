import { getTranslations } from "next-intl/server";
import { navItems } from "@/features/registry";

export interface ShellNavItem {
  id: string;
  href: string;
  label: string;
}

/** Home plus every registered feature entry, with labels resolved in the request locale. */
export async function shellNavItems(locale: string): Promise<ShellNavItem[]> {
  const t = await getTranslations({ locale });
  const home: ShellNavItem = { id: "home", href: "/", label: t("common.nav.home") };
  return [
    home,
    ...navItems.map((item) => ({
      id: item.id,
      href: item.href,
      // A lane may register an entry before its messages land; fall back to the id.
      label: t.has(item.labelKey) ? t(item.labelKey) : item.id,
    })),
  ];
}

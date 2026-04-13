import { nav as bondsNav } from "./bonds/nav";
import { nav as marketsNav } from "./markets/nav";
import { nav as walletNav } from "./wallet/nav";
import { nav as downloadNav } from "./download/nav";

export interface NavItem {
  id: string;
  /** Locale-less path, e.g. "/prize-bonds". Render with the i18n `Link`. */
  href: string;
  /** Message key in the owning lane's namespace, e.g. "bonds.nav.title". */
  labelKey: string;
  /** Sort position in the main navigation (lower first). */
  order: number;
}

/**
 * Navigation registry. The shell (Lane D) renders `navItems`; each feature area contributes
 * its entries from `features/<area>/nav.ts`, so lanes never edit shared layout code.
 */
export const navItems: NavItem[] = [...bondsNav, ...marketsNav, ...walletNav, ...downloadNav].sort(
  (a, b) => a.order - b.order,
);

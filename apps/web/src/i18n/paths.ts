/**
 * Locale-less public URL builders shared by the shell, the home page and the sitemap. Client safe
 * (no server imports). Denomination slugs come from the bond feature; the market page list is
 * owned by `features/markets/sitemap.ts`.
 */
import { denominationSlug } from "@/features/bonds/labels";

export { denominationSlug };

export const paths = {
  home: "/",
  bonds: "/prize-bonds",
  check: "/prize-bonds/check",
  coverage: "/prize-bonds/coverage",
  denomination: (code: string) => `/prize-bonds/${denominationSlug(code)}`,
  draw: (code: string, drawNumber: number) => `/prize-bonds/${denominationSlug(code)}/${drawNumber}`,
  schedule: (year: number) => `/prize-bonds/schedule/${year}`,
  gold: "/gold-rate",
  silver: "/silver-rate",
  metal: (slug: string) => `/metals/${slug}`,
  currency: "/currency",
  pair: (pair: string) => `/currency/${pair}`,
  wallet: "/my",
  walletSettings: "/my/settings",
  download: "/download",
  about: "/about",
  data: "/about/data",
  privacy: "/privacy",
  terms: "/terms",
} as const;

import type { MetadataRoute } from "next";

/**
 * Web app manifest (installability, PLAN D2). English is the default; the start URL is `/`, so
 * the proxy opens the installed app in the language the person chose last.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BondCheck: prize bonds, gold and rupee",
    short_name: "BondCheck",
    description: "Prize bond results back to 2000, your bonds without an account, and gold and rupee rates for Pakistan.",
    lang: "en",
    dir: "auto",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f1e6",
    theme_color: "#0a6b47",
    categories: ["finance", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Check a bond", short_name: "Check", url: "/en/prize-bonds/check", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My bonds", url: "/en/my", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Gold rate", url: "/en/gold-rate", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

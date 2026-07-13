import { revalidatePath, revalidateTag } from "next/cache";

/**
 * All cache invalidation goes through here so the Cloudflare (OpenNext) port changes one file.
 * Tags: `bonds`, `bonds:<denomination>`, `draw:<id>`, `markets`.
 */
export function revalidateTags(tags: readonly string[]): void {
  for (const tag of tags) revalidateTag(tag, "max");
  // The pages are rebuilt too, so new numbers show without waiting for their timer.
  const sections = new Set(tags.flatMap((tag) => SECTIONS[tag.split(":")[0]!] ?? []));
  for (const path of sections) revalidatePath(path, "layout");
  // The home page shows both, but only the page itself: the layout would rebuild the whole site.
  if (sections.size) revalidatePath("/[locale]", "page");
}

const SECTIONS: Record<string, readonly string[]> = {
  bonds: ["/[locale]/prize-bonds"],
  markets: ["/[locale]/gold-rate", "/[locale]/silver-rate", "/[locale]/metals", "/[locale]/currency"],
};

export const bondTags = (denomination: string, drawId?: number): string[] => [
  "bonds",
  `bonds:${denomination}`,
  ...(drawId === undefined ? [] : [`draw:${drawId}`]),
];

export const MARKETS_TAG = "markets";

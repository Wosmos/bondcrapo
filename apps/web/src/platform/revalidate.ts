import { revalidateTag } from "next/cache";

/**
 * All cache invalidation goes through here so the Cloudflare (OpenNext) port changes one file.
 * Tags: `bonds`, `bonds:<denomination>`, `draw:<id>`, `markets`.
 */
export function revalidateTags(tags: readonly string[]): void {
  for (const tag of tags) revalidateTag(tag, "max");
}

export const bondTags = (denomination: string, drawId?: number): string[] => [
  "bonds",
  `bonds:${denomination}`,
  ...(drawId === undefined ? [] : [`draw:${drawId}`]),
];

export const MARKETS_TAG = "markets";

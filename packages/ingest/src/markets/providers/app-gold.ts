import { z } from "zod";
import { ParseError, type PriceProvider, type ReportedBatch, type ReportedRate } from "../types";
import { htmlToText } from "./html";

/**
 * The All Pakistan Sarafa Gems and Jewellers Association (APSGJA) has no feed; its daily rates
 * reach the public through the Associated Press of Pakistan wire, e.g.
 * "Gold prices remain unchanged at Rs437,836 per tola". We read APP's WordPress REST search
 * (public, robots allow) and parse each story with strict, clause based patterns. Values are
 * cross-checked against the derived price by the job (more than 5% apart is rejected).
 */
export const APP_SEARCH_URL =
  "https://www.app.com.pk/wp-json/wp/v2/posts?search=gold%20tola&per_page=10&_fields=id,date,link,title,content";

const post = z.object({
  id: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
  link: z.string().url(),
  title: z.object({ rendered: z.string() }),
  content: z.object({ rendered: z.string() }),
});

const RS = /Rs\.?\s?(\d{1,3}(?:,\d{3})+|\d+)/gi;

/** Last rupee amount in a clause: "fell by Rs2,358 to Rs344,104" is 344,104, not the change. */
function lastRupees(clause: string): number | null {
  const all = [...clause.matchAll(RS)];
  const last = all[all.length - 1];
  return last ? Number(last[1]!.replace(/,/g, "")) : null;
}

function lastDollars(clause: string): number | null {
  const all = [...clause.matchAll(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g)];
  const last = all[all.length - 1];
  return last ? Number(last[1]!.replace(/,/g, "")) : null;
}

/** Splits a story into clauses at sentence ends, ", while" and ", according". */
function clauses(text: string): string[] {
  return text
    .split(/(?<=\.)\s+(?=[A-Z])|,\s*while\s+|,\s*according\s+|;\s+|\n+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

export function parseAppGoldStory(input: { date: string; link: string; title: string; html: string }): ReportedBatch | null {
  const text = htmlToText(input.html);
  if (!/Sarafa|APSGJA|Jewellers Association/i.test(text)) return null;
  const observedAt = new Date(`${input.date}+05:00`);
  const date = input.date.slice(0, 10);
  const rates: ReportedRate[] = [];
  const quotedSpotUsd: ReportedBatch["quotedSpotUsd"] = {};
  const add = (metal: "XAU" | "XAG", karat: number, unit: ReportedRate["unit"], price: number | null) => {
    if (price === null || rates.some((r) => r.metal === metal && r.karat === karat && r.unit === unit)) return;
    rates.push({ country: "PK", city: "", metal, karat, unit, currency: "PKR", price, date, observedAt, source: "app-apsgja" });
  };
  for (const c of clauses(text)) {
    const lc = c.toLowerCase();
    if (/international market/.test(lc)) {
      if (/silver/.test(lc)) quotedSpotUsd.XAG ??= lastDollars(c) ?? undefined;
      else if (/gold/.test(lc)) quotedSpotUsd.XAU ??= lastDollars(c) ?? undefined;
      continue;
    }
    if (/24[- ]karat gold per tola|tola of 24[- ]karat/.test(lc)) add("XAU", 24, "tola", lastRupees(c));
    else if (/10 grams? of 24[- ]karat/.test(lc)) add("XAU", 24, "10g", lastRupees(c));
    else if (/10 grams? of 22[- ]karat/.test(lc)) add("XAU", 22, "10g", lastRupees(c));
    else if (/silver per tola|tola of silver/.test(lc)) add("XAG", 0, "tola", lastRupees(c));
    else if (/10 grams? of silver/.test(lc)) add("XAG", 0, "10g", lastRupees(c));
  }
  if (!rates.some((r) => r.metal === "XAU" && r.karat === 24 && r.unit === "tola")) return null;
  return { date, observedAt, url: input.link, rates, quotedSpotUsd };
}

/** Newest APSGJA report among the stories (WordPress returns newest first, we sort anyway). */
export function parseAppGoldPosts(json: unknown): ReportedBatch {
  const r = z.array(post).safeParse(json);
  if (!r.success) throw new ParseError("app-apsgja", "unexpected payload");
  const sorted = [...r.data].sort((a, b) => b.date.localeCompare(a.date));
  for (const p of sorted) {
    if (!/gold/i.test(p.title.rendered)) continue;
    const batch = parseAppGoldStory({ date: p.date, link: p.link, title: p.title.rendered, html: p.content.rendered });
    if (batch) return batch;
  }
  throw new ParseError("app-apsgja", "no story with an APSGJA 24 karat tola rate");
}

export const appGoldProvider: PriceProvider<ReportedBatch> = {
  id: "app-apsgja",
  dataset: "pk-gold-reported",
  enabled: () => true,
  async fetch({ fetcher }) {
    const res = await fetcher.get(APP_SEARCH_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new ParseError("app-apsgja", `HTTP ${res.status}`);
    return parseAppGoldPosts(JSON.parse(res.body));
  },
};

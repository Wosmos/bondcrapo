import { db } from "@/lib/db";
import { newsArticles } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

// ── GNews API — free tier: 100 req/day, no credit card ──
// https://gnews.io/api/v4/search

const GNEWS_BASE = "https://gnews.io/api/v4/search";

// Category mapping: search query -> category tag
const SEARCH_QUERIES: { q: string; category: string }[] = [
  { q: "pakistan economy", category: "economy" },
  { q: "pakistan gold price", category: "economy" },
  { q: "pakistan petrol price", category: "energy" },
  { q: "pakistan government scheme", category: "government" },
  { q: "islamic banking pakistan", category: "islamic_finance" },
];

interface GNewsArticle {
  title: string;
  description: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

/**
 * Fetch latest Pakistani financial news from GNews API.
 * Runs multiple search queries and deduplicates by URL.
 */
export async function fetchNews(): Promise<{
  inserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let inserted = 0;

  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    return { inserted: 0, errors: ["GNEWS_API_KEY not set — skipping news fetch"] };
  }

  // Collect all articles, dedup by URL
  const seen = new Set<string>();
  const allArticles: { article: GNewsArticle; category: string }[] = [];

  for (const { q, category } of SEARCH_QUERIES) {
    try {
      const url = `${GNEWS_BASE}?${new URLSearchParams({
        q,
        lang: "en",
        country: "pk",
        max: "10",
        apikey: apiKey,
      })}`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        errors.push(`GNews query "${q}" returned ${res.status}`);
        continue;
      }

      const data = (await res.json()) as GNewsResponse;

      for (const article of data.articles ?? []) {
        if (!seen.has(article.url)) {
          seen.add(article.url);
          allArticles.push({ article, category });
        }
      }
    } catch (err) {
      errors.push(
        `GNews query "${q}" failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Insert into DB, skip duplicates
  for (const { article, category } of allArticles) {
    try {
      await db
        .insert(newsArticles)
        .values({
          title: article.title,
          description: article.description || null,
          url: article.url,
          sourceName: article.source?.name || null,
          imageUrl: article.image || null,
          publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
          category,
        })
        .onConflictDoNothing({ target: newsArticles.url });
      inserted++;
    } catch (err) {
      errors.push(
        `Insert failed for "${article.title.slice(0, 40)}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return { inserted, errors };
}

/**
 * Get latest news from database.
 */
export async function getLatestNews(
  limit: number = 20,
  category?: string
) {
  const conditions = category ? eq(newsArticles.category, category) : undefined;

  const rows = await db
    .select()
    .from(newsArticles)
    .where(conditions)
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    url: r.url,
    source_name: r.sourceName,
    image_url: r.imageUrl,
    published_at: r.publishedAt ? r.publishedAt.toISOString() : null,
    category: r.category,
  }));
}

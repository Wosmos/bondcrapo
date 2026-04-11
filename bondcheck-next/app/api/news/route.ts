import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { fetchNews, getLatestNews } from "@/lib/scrapers/news";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "news");
  if (!rl.success) return rl.response!;

  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 50);
  const category = searchParams.get("category") ?? undefined;

  try {
    // Fetch fresh news from GNews if DB is stale or empty
    let articles = await getLatestNews(limit, category);

    if (articles.length === 0) {
      // No cached articles — try fetching from API
      await fetchNews();
      articles = await getLatestNews(limit, category);
    }

    return NextResponse.json({ articles, total: articles.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

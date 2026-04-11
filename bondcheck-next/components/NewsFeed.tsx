"use client";

import { useState } from "react";
import useSWR from "swr";
import type { NewsArticle } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface NewsResponse {
  articles: NewsArticle[];
  total: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  economy: "Economy",
  government: "Government",
  islamic_finance: "Islamic Finance",
  energy: "Energy",
  agriculture: "Agriculture",
};

const CATEGORY_COLORS: Record<string, string> = {
  economy: "bg-blue-50 text-blue-600",
  government: "bg-amber-50 text-amber-600",
  islamic_finance: "bg-emerald-50 text-emerald-600",
  energy: "bg-orange-50 text-orange-600",
  agriculture: "bg-lime-50 text-lime-600",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function NewsFeed() {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useSWR<NewsResponse>(
    "/api/news?limit=20",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 600_000, // 10 minutes
    }
  );

  const articles = data?.articles ?? [];
  const visible = showAll ? articles : articles.slice(0, 10);
  const hasMore = articles.length > 10;

  return (
    <div className="mb-10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg
          className="w-4 h-4 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          <path d="M18 14h-8" />
          <path d="M15 18h-5" />
          <path d="M10 6h8v4h-8V6Z" />
        </svg>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Latest News
        </h2>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="border border-gray-200 rounded-sm bg-white p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-2 bg-gray-50 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && articles.length === 0 && (
        <div className="border border-gray-200 rounded-sm bg-white p-6 text-center">
          <p className="text-sm text-gray-400">No news available</p>
          <p className="text-[10px] text-gray-300 mt-1">
            Financial news will appear here once fetched
          </p>
        </div>
      )}

      {/* Articles list */}
      {!isLoading && articles.length > 0 && (
        <div className="border border-gray-200 rounded-sm bg-white divide-y divide-gray-100">
          {visible.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-800 leading-snug mb-1">
                    {article.title}
                  </h3>
                  {article.description && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-1.5">
                      {article.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {article.category && (
                      <span
                        className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          CATEGORY_COLORS[article.category] ?? "bg-gray-50 text-gray-500"
                        }`}
                      >
                        {CATEGORY_LABELS[article.category] ?? article.category}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {article.source_name && `${article.source_name}`}
                      {article.source_name && article.published_at && " \u00b7 "}
                      {article.published_at && timeAgo(article.published_at)}
                    </span>
                  </div>
                </div>
                {article.image_url && (
                  <img
                    src={article.image_url}
                    alt=""
                    className="w-16 h-16 rounded-sm object-cover flex-shrink-0 bg-gray-100"
                    loading="lazy"
                  />
                )}
              </div>
            </a>
          ))}

          {/* View More / View Less */}
          {hasMore && (
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowAll((prev) => !prev);
              }}
              className="w-full px-4 py-2.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 hover:bg-gray-50/50 transition-colors"
            >
              {showAll ? "Show Less" : `View More (${articles.length - 10} more)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

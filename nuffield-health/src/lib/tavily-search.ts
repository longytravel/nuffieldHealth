import { readFileSync, writeFileSync, existsSync } from "fs";
import { TAVILY_API_KEY } from "@/lib/config";
import type { SearchUsage } from "@/lib/types";

// Returned by searchWeb
export interface SearchResult {
  url: string;
  title: string;
  description: string;
}

// Returned by searchImages
export interface ImageSearchResult {
  url: string;
  thumbnail_url: string;
  width: number | null;
  height: number | null;
  source_url: string;
}

const SEARCH_USAGE_PATH = "data/search-usage.json";
const SEARCH_DELAY_MS = 1500;
const WARN_THRESHOLD = 800;
const HARD_STOP_THRESHOLD = 950;

// Domains to exclude per spec §4.1 and §2
const EXCLUDED_DOMAINS = [
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "doctify.com",
  "topdoctors.co.uk",
  "iwantgreatcare.org",
];

function isExcludedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return EXCLUDED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function readUsage(): SearchUsage {
  if (!existsSync(SEARCH_USAGE_PATH)) {
    return { month: currentMonth(), queries_used: 0, last_query_at: null };
  }
  try {
    const raw = readFileSync(SEARCH_USAGE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as SearchUsage;
    if (parsed.month !== currentMonth()) {
      return { month: currentMonth(), queries_used: 0, last_query_at: null };
    }
    return parsed;
  } catch {
    return { month: currentMonth(), queries_used: 0, last_query_at: null };
  }
}

function writeUsage(usage: SearchUsage): void {
  writeFileSync(SEARCH_USAGE_PATH, JSON.stringify(usage, null, 2), "utf-8");
}

function incrementUsage(): SearchUsage {
  const usage = readUsage();
  usage.queries_used += 1;
  usage.last_query_at = new Date().toISOString();
  writeUsage(usage);
  return usage;
}

function checkQuota(): void {
  const usage = readUsage();
  if (usage.queries_used >= HARD_STOP_THRESHOLD) {
    throw new Error(
      `Tavily search hard stop: ${usage.queries_used}/${HARD_STOP_THRESHOLD} queries used this month. Free tier allows 1,000/month.`
    );
  }
  if (usage.queries_used >= WARN_THRESHOLD) {
    console.warn(
      `[tavily-search] WARNING: ${usage.queries_used} search queries used this month (warn threshold: ${WARN_THRESHOLD})`
    );
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Search the web via Tavily Search API.
 * Applies rate limiting, quota tracking, and URL filtering.
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not set");
  }

  checkQuota();
  await delay(SEARCH_DELAY_MS);

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      api_key: TAVILY_API_KEY,
      max_results: 10,
      search_depth: "basic",
      include_images: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily Web Search API error: ${response.status} ${response.statusText}`);
  }

  incrementUsage();

  const data = (await response.json()) as {
    results?: { url: string; title: string; content?: string }[];
  };

  const results = data.results ?? [];

  return results
    .filter((r) => !isExcludedUrl(r.url))
    .map((r) => ({
      url: r.url,
      title: r.title,
      description: r.content ?? "",
    }));
}

/**
 * Search for images via Tavily Search API.
 * Tavily returns images alongside web results when include_images is true.
 * Maps to the same ImageSearchResult interface for compatibility.
 */
export async function searchImages(query: string): Promise<ImageSearchResult[]> {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not set");
  }

  checkQuota();
  await delay(SEARCH_DELAY_MS);

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      api_key: TAVILY_API_KEY,
      max_results: 10,
      search_depth: "basic",
      include_images: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily Image Search API error: ${response.status} ${response.statusText}`);
  }

  incrementUsage();

  const data = (await response.json()) as {
    images?: { url: string }[];
  };

  const images = data.images ?? [];

  return images
    .filter((r) => !isExcludedUrl(r.url))
    .map((r) => ({
      url: r.url,
      thumbnail_url: r.url,
      width: null,
      height: null,
      source_url: r.url,
    }));
}

/** Read current usage stats (for UI display) */
export function getSearchUsage(): SearchUsage {
  return readUsage();
}

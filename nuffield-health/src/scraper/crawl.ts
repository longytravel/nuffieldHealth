import { chromium, Browser, Page } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  HTML_CACHE_PATH,
  SCRAPE_DELAY_MS,
  calculateRetryDelay,
  MAX_RETRIES_429,
  MAX_RETRIES_503,
  MAX_RETRIES_5XX,
  MAX_RETRIES_TIMEOUT,
  BASE_DELAY_429_MS,
  BASE_DELAY_503_MS,
  BASE_DELAY_5XX_MS,
  BASE_DELAY_TIMEOUT_MS,
} from "@/lib/config";
import { CrawlError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const SITEMAP_URL = "https://www.nuffieldhealth.com/sitemap_consultants.xml";
const CONSULTANT_URL_PREFIX = "https://www.nuffieldhealth.com/consultants/";

export interface CrawlResult {
  slug: string;
  html: string;
  httpStatus: number;
  url: string;
}

/**
 * Fetch and parse the consultant sitemap XML.
 * Returns deduplicated list of { url, slug } entries.
 */
export async function fetchSitemapUrls(): Promise<{ url: string; slug: string }[]> {
  const response = await fetch(SITEMAP_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: HTTP ${response.status}`);
  }
  const xml = await response.text();

  // Extract URLs from <loc> tags using regex — sitemap XML is simple enough
  const locRegex = /<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi;
  const urls = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url.startsWith(CONSULTANT_URL_PREFIX)) {
      urls.add(url);
    }
  }

  const entries = Array.from(urls).map((url) => {
    const slug = url.replace(CONSULTANT_URL_PREFIX, "").replace(/\/$/, "");
    return { url, slug };
  });

  logger.info("CRAWL", "sitemap", "success", `${entries.length} consultant URLs found`);

  return entries;
}

/**
 * Launch a single Playwright browser instance for the full run.
 */
export async function launchBrowser(): Promise<Browser> {
  const browser = await chromium.launch({ headless: true });
  logger.info("CRAWL", "browser", "launched");
  return browser;
}

/**
 * Determine retry parameters for a given HTTP status or error type.
 */
function getRetryConfig(status: number | "timeout"): { maxRetries: number; baseDelay: number } | null {
  if (status === 429) return { maxRetries: MAX_RETRIES_429, baseDelay: BASE_DELAY_429_MS };
  if (status === 503) return { maxRetries: MAX_RETRIES_503, baseDelay: BASE_DELAY_503_MS };
  if (status === "timeout") return { maxRetries: MAX_RETRIES_TIMEOUT, baseDelay: BASE_DELAY_TIMEOUT_MS };
  if (typeof status === "number" && status >= 500) return { maxRetries: MAX_RETRIES_5XX, baseDelay: BASE_DELAY_5XX_MS };
  return null;
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Click all "View more" buttons on the page to expand hidden content.
 */
async function clickViewMoreButtons(page: Page): Promise<void> {
  const buttons = page.locator('button:has-text("View more"), a:has-text("View more")');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    try {
      await buttons.nth(i).click({ timeout: 2000 });
      await sleep(300);
    } catch {
      // Some buttons may not be clickable — continue
    }
  }
}

/**
 * Fetch a single consultant profile page using Playwright.
 * Saves the raw HTML to disk and returns the result.
 */
export async function fetchProfile(
  browser: Browser,
  url: string,
  slug: string,
  runId: string,
  progress?: { current: number; total: number }
): Promise<CrawlResult> {
  const cacheDir = join(HTML_CACHE_PATH, runId);
  mkdirSync(cacheDir, { recursive: true });

  let lastError: unknown = null;

  // Attempt with retries
  for (let attempt = 0; ; attempt++) {
    const page = await browser.newPage();
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      const status = response?.status() ?? 0;

      // 200: success
      if (status === 200) {
        await clickViewMoreButtons(page);
        await sleep(500); // Brief wait for expanded content
        const html = await page.content();
        const cachePath = join(cacheDir, `${slug}.html`);
        writeFileSync(cachePath, html, "utf-8");
        logger.info("CRAWL", slug, "success", `${status}`, progress);
        return { slug, html, httpStatus: status, url };
      }

      // 404: profile deleted — still save the HTML for record
      if (status === 404) {
        const html = await page.content();
        const cachePath = join(cacheDir, `${slug}.html`);
        writeFileSync(cachePath, html, "utf-8");
        logger.info("CRAWL", slug, "deleted", "404", progress);
        return { slug, html, httpStatus: 404, url };
      }

      // Retryable status codes
      const retryConfig = getRetryConfig(status);
      if (retryConfig && attempt < retryConfig.maxRetries) {
        const delay = calculateRetryDelay(retryConfig.baseDelay, attempt);
        logger.warn("CRAWL", slug, "retry", `HTTP ${status}, attempt ${attempt + 1}/${retryConfig.maxRetries}, waiting ${Math.round(delay)}ms`, progress);
        await sleep(delay);
        continue;
      }

      // Non-retryable or retries exhausted
      throw new CrawlError(`HTTP ${status} after ${attempt} retries`, slug);
    } catch (error) {
      lastError = error;

      // If it's already a CrawlError, rethrow
      if (error instanceof CrawlError) throw error;

      // Timeout errors
      const isTimeout = error instanceof Error && (
        error.message.includes("Timeout") || error.message.includes("timeout")
      );

      if (isTimeout) {
        const retryConfig = getRetryConfig("timeout");
        if (retryConfig && attempt < retryConfig.maxRetries) {
          const delay = calculateRetryDelay(retryConfig.baseDelay, attempt);
          logger.warn("CRAWL", slug, "retry", `timeout, attempt ${attempt + 1}/${retryConfig.maxRetries}, waiting ${Math.round(delay)}ms`, progress);
          await sleep(delay);
          continue;
        }
      }

      throw new CrawlError(
        `Failed to fetch profile: ${error instanceof Error ? error.message : String(error)}`,
        slug,
        error
      );
    } finally {
      await page.close();
    }
  }
}

/**
 * Apply the polite scraping delay between page loads.
 */
export async function applyScrapeDelay(): Promise<void> {
  await sleep(SCRAPE_DELAY_MS);
}

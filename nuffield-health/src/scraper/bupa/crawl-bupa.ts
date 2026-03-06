import { chromium, Browser, Page } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  BUPA_SCRAPE_DELAY_MS,
  BUPA_HTML_CACHE_PATH,
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
import { logger } from "@/lib/logger";

export interface BupaCrawlResult {
  bupa_id: string;
  html: string;
  http_status: number;
  url: string;
}

/**
 * Launch a Playwright browser configured for BUPA scraping.
 * Uses ignoreHTTPSErrors because BUPA Finder has cert issues.
 */
export async function launchBupaBrowser(): Promise<Browser> {
  const browser = await chromium.launch({
    headless: true,
  });
  logger.info("BUPA_CRL", "browser", "launched");
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
 * Fetch a single BUPA consultant profile page using Playwright.
 * BUPA Finder is client-side rendered (Backbone.js + RequireJS), so we must
 * wait for JS to populate the DOM before capturing HTML.
 * Saves raw HTML to disk and returns the result.
 */
export async function fetchBupaProfile(
  browser: Browser,
  url: string,
  bupaId: string,
  runId: string,
  progress?: { current: number; total: number }
): Promise<BupaCrawlResult> {
  const cacheDir = join(BUPA_HTML_CACHE_PATH, runId);
  mkdirSync(cacheDir, { recursive: true });

  for (let attempt = 0; ; attempt++) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "CambrianBot/1.0 (consultant-intelligence)",
    });
    const page = await context.newPage();

    try {
      const response = await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });

      const status = response?.status() ?? 0;

      // 200: success — wait for client-side rendering to complete
      if (status === 200) {
        await waitForBupaContent(page);
        const html = await page.content();
        const cachePath = join(cacheDir, `${bupaId}.html`);
        writeFileSync(cachePath, html, "utf-8");
        logger.info("BUPA_CRL", bupaId, "success", `${status}`, progress);
        return { bupa_id: bupaId, html, http_status: status, url };
      }

      // 404: profile gone — save HTML for record
      if (status === 404) {
        const html = await page.content();
        const cachePath = join(cacheDir, `${bupaId}.html`);
        writeFileSync(cachePath, html, "utf-8");
        logger.info("BUPA_CRL", bupaId, "deleted", "404", progress);
        return { bupa_id: bupaId, html, http_status: 404, url };
      }

      // Retryable status codes
      const retryConfig = getRetryConfig(status);
      if (retryConfig && attempt < retryConfig.maxRetries) {
        const delay = calculateRetryDelay(retryConfig.baseDelay, attempt);
        logger.warn("BUPA_CRL", bupaId, "retry", `HTTP ${status}, attempt ${attempt + 1}/${retryConfig.maxRetries}, waiting ${Math.round(delay)}ms`, progress);
        await sleep(delay);
        continue;
      }

      // Non-retryable or retries exhausted
      throw new Error(`BUPA crawl failed: HTTP ${status} after ${attempt} retries for ${bupaId}`);
    } catch (error) {
      // If it's our own thrown error, rethrow
      if (error instanceof Error && error.message.startsWith("BUPA crawl failed:")) {
        throw error;
      }

      // Timeout errors — retry if possible
      const isTimeout = error instanceof Error && (
        error.message.includes("Timeout") || error.message.includes("timeout")
      );

      if (isTimeout) {
        const retryConfig = getRetryConfig("timeout");
        if (retryConfig && attempt < retryConfig.maxRetries) {
          const delay = calculateRetryDelay(retryConfig.baseDelay, attempt);
          logger.warn("BUPA_CRL", bupaId, "retry", `timeout, attempt ${attempt + 1}/${retryConfig.maxRetries}, waiting ${Math.round(delay)}ms`, progress);
          await sleep(delay);
          continue;
        }
      }

      throw new Error(
        `BUPA crawl failed for ${bupaId}: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await page.close();
      await context.close();
    }
  }
}

/**
 * Wait for BUPA Finder's client-side rendering to populate the DOM.
 * BUPA uses Backbone.js + RequireJS — the page loads a shell then
 * hydrates consultant data via JS.
 */
async function waitForBupaContent(page: Page): Promise<void> {
  // Try multiple selectors that indicate content has rendered
  const contentSelectors = [
    ".consultant-detail",
    ".consultant-profile",
    "[data-consultant-id]",
    ".profile-header",
    "h1",
  ];

  for (const selector of contentSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 15_000 });
      // Give a brief moment for any remaining JS to finish
      await sleep(1000);
      return;
    } catch {
      // Selector not found — try next
    }
  }

  // Fallback: just wait a bit for any JS rendering
  logger.warn("BUPA_CRL", "content", "fallback-wait", "no known selector found, waiting 5s");
  await sleep(5000);
}

/**
 * Apply the polite scraping delay between BUPA page loads.
 */
export async function applyBupaScrapeDelay(): Promise<void> {
  await sleep(BUPA_SCRAPE_DELAY_MS);
}

import { randomUUID } from "crypto";
import {
  APIM_SUBSCRIPTION_KEY,
  API_DELAY_MS,
  BOOKING_API_CONCURRENCY,
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
import { BookingApiError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const BOOKING_API_BASE = "https://api.nuffieldhealth.com/booking/consultant/1.0";
const BOOKING_OPEN_BASE = "https://api.nuffieldhealth.com/booking/open/1.0";

export interface BookingResult {
  available_days_next_28_days: number;
  available_slots_next_28_days: number;
  avg_slots_per_day: number | null;
  next_available_date: string | null;
  days_to_first_available: number | null;
  consultation_price: number | null;
  booking_state: "not_bookable" | "bookable_no_slots" | "bookable_with_slots";
}

// Global semaphore for limiting concurrent booking API requests
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

async function acquireSemaphore(): Promise<void> {
  if (activeRequests < BOOKING_API_CONCURRENCY) {
    activeRequests++;
    return;
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSemaphore(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryConfig(status: number | "timeout"): { maxRetries: number; baseDelay: number } | null {
  if (status === 429) return { maxRetries: MAX_RETRIES_429, baseDelay: BASE_DELAY_429_MS };
  if (status === 503) return { maxRetries: MAX_RETRIES_503, baseDelay: BASE_DELAY_503_MS };
  if (status === "timeout") return { maxRetries: MAX_RETRIES_TIMEOUT, baseDelay: BASE_DELAY_TIMEOUT_MS };
  if (typeof status === "number" && status >= 500) return { maxRetries: MAX_RETRIES_5XX, baseDelay: BASE_DELAY_5XX_MS };
  return null;
}

/**
 * Make an API request with retry logic and semaphore-based concurrency control.
 */
async function apiRequest(url: string, slug: string): Promise<{ status: number; data: unknown }> {
  await acquireSemaphore();
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15_000);

        const response = await fetch(url, {
          headers: {
            "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 404 = valid "not bookable online" state
        if (response.status === 404) {
          return { status: 404, data: null };
        }

        if (response.ok) {
          const data = await response.json();
          return { status: response.status, data };
        }

        // Retryable status
        const retryConfig = getRetryConfig(response.status);
        if (retryConfig && attempt < retryConfig.maxRetries) {
          const delay = calculateRetryDelay(retryConfig.baseDelay, attempt);
          logger.warn("BOOKING", slug, "retry", `HTTP ${response.status}, attempt ${attempt + 1}/${retryConfig.maxRetries}`);
          await sleep(delay);
          continue;
        }

        throw new BookingApiError(`HTTP ${response.status} from ${url}`, slug);
      } catch (error) {
        if (error instanceof BookingApiError) throw error;

        const isTimeout = error instanceof Error && (
          error.name === "AbortError" ||
          error.message.includes("timeout") ||
          error.message.includes("Timeout")
        );

        if (isTimeout) {
          const retryConfig = getRetryConfig("timeout");
          if (retryConfig && attempt < retryConfig.maxRetries) {
            const delay = calculateRetryDelay(retryConfig.baseDelay, attempt);
            logger.warn("BOOKING", slug, "retry", `timeout, attempt ${attempt + 1}/${retryConfig.maxRetries}`);
            await sleep(delay);
            continue;
          }
        }

        throw new BookingApiError(
          `API request failed: ${error instanceof Error ? error.message : String(error)}`,
          slug,
          error
        );
      }
    }
  } finally {
    releaseSemaphore();
  }
}

function todayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

interface SlotQuery {
  date: string;
  hospitalId: string;
}

/**
 * Fetch booking data for a single consultant.
 * Only call when gmc_code_for_booking is non-null AND online_bookable is true.
 */
export async function fetchBookingData(
  gmc_code_for_booking: string,
  slug: string,
  progress?: { current: number; total: number }
): Promise<BookingResult> {
  const fromDate = todayDateString();

  // Step 1: Fetch clinic days (span=90 for extended next_available_date discovery)
  const clinicDaysUrl = `${BOOKING_API_BASE}/clinicdays/gmc/${gmc_code_for_booking}?span=90&fromDate=${fromDate}`;
  const clinicDaysResponse = await apiRequest(clinicDaysUrl, slug);

  if (clinicDaysResponse.status === 404) {
    logger.info("BOOKING", slug, "not_bookable", "clinicdays returned 404", progress);
    return {
      available_days_next_28_days: 0,
      available_slots_next_28_days: 0,
      avg_slots_per_day: null,
      next_available_date: null,
      days_to_first_available: null,
      consultation_price: null,
      booking_state: "not_bookable",
    };
  }

  // Parse clinic days — API returns { results: [{ date, locations: [{ hospitalId }] }] }
  const responseData = clinicDaysResponse.data as Record<string, unknown> | null;
  const results = responseData && Array.isArray((responseData as Record<string, unknown>).results)
    ? (responseData as Record<string, unknown>).results as Array<Record<string, unknown>>
    : [];

  // Build unique (date, hospitalId) pairs for slot queries
  const slotQueries: SlotQuery[] = [];
  const seenPairs = new Set<string>();

  for (const day of results) {
    const date = day.date as string | undefined;
    const locations = Array.isArray(day.locations) ? day.locations as Array<Record<string, unknown>> : [];
    if (!date) continue;
    for (const loc of locations) {
      const hospitalId = loc.hospitalId as string | undefined;
      if (!hospitalId) continue;
      const key = `${date}|${hospitalId}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        slotQueries.push({ date, hospitalId });
      }
    }
  }

  // Parallel: slots for each (date, hospital) + pricing
  // uid is a correlation ID — generate a random UUID per request
  const slotPromises = slotQueries.map((query) => {
    const uid = randomUUID();
    const slotsUrl = `${BOOKING_API_BASE}/slots?uid=${uid}&fromDate=${query.date}&gmcCode=${gmc_code_for_booking}&hospitalId=${query.hospitalId}&sessionDays=0`;
    return apiRequest(slotsUrl, slug);
  });

  const pricingUrl = `${BOOKING_OPEN_BASE}/consultants/${gmc_code_for_booking}/pricing/`;
  const pricingPromise = apiRequest(pricingUrl, slug);

  const [slotResults, pricingResult] = await Promise.all([
    Promise.all(slotPromises),
    pricingPromise,
  ]);

  // Aggregate slots across all hospitals
  // Slots response: { response: { responseData: { bookingDetails: [{ slotId, slotDate, slotTime, slotDuration }] } } }
  // Compute the 28-day cutoff for splitting metrics
  const cutoff28 = new Date(fromDate);
  cutoff28.setDate(cutoff28.getDate() + 28);
  const cutoff28Str = cutoff28.toISOString().split("T")[0];

  let totalSlots28 = 0;
  let earliestDate: string | null = null;
  const datesWithSlots28 = new Set<string>();

  for (const result of slotResults) {
    if (result.status === 404 || !result.data) continue;

    const data = result.data as Record<string, unknown>;
    const resp = data.response as Record<string, unknown> | undefined;
    const respData = resp?.responseData as Record<string, unknown> | undefined;
    const bookingDetails = Array.isArray(respData?.bookingDetails) ? respData.bookingDetails as Array<Record<string, unknown>> : [];

    for (const slot of bookingDetails) {
      const slotDate = slot.slotDate as string | undefined;
      if (slotDate) {
        // Track earliest date across full 90-day window
        if (!earliestDate || slotDate < earliestDate) {
          earliestDate = slotDate;
        }
        // 28-day metrics: only count slots within 28 days
        if (slotDate < cutoff28Str) {
          totalSlots28++;
          datesWithSlots28.add(slotDate);
        }
      }
    }
  }

  const availableDays = datesWithSlots28.size;

  // Extract pricing
  let consultationPrice: number | null = null;
  if (pricingResult.status !== 404 && pricingResult.data) {
    const pricingData = pricingResult.data;
    if (Array.isArray(pricingData) && pricingData.length > 0) {
      // Find the lowest consultation price across hospitals
      for (const entry of pricingData) {
        if (entry && typeof entry === "object") {
          const price = (entry as Record<string, unknown>).price as number | string | undefined;
          if (price !== undefined && price !== null) {
            const numPrice = typeof price === "number" ? price : parseFloat(String(price));
            if (!isNaN(numPrice) && (consultationPrice === null || numPrice < consultationPrice)) {
              consultationPrice = numPrice;
            }
          }
        }
      }
    } else if (typeof pricingData === "object" && pricingData !== null) {
      const price = (pricingData as Record<string, unknown>).price as number | string | undefined;
      if (price !== undefined && price !== null) {
        const numPrice = typeof price === "number" ? price : parseFloat(String(price));
        if (!isNaN(numPrice)) {
          consultationPrice = numPrice;
        }
      }
    }
  }

  // booking_state is scoped to 28-day window
  const bookingState = totalSlots28 > 0 ? "bookable_with_slots" : "bookable_no_slots";
  const avgSlotsPerDay = availableDays > 0 ? Math.round((totalSlots28 / availableDays) * 10) / 10 : null;

  // days_to_first_available: calendar days from scrape date to next_available_date
  let daysToFirst: number | null = null;
  if (earliestDate) {
    const scrapeDate = new Date(fromDate);
    const firstDate = new Date(earliestDate);
    daysToFirst = Math.round((firstDate.getTime() - scrapeDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  logger.info("BOOKING", slug, "success", `${availableDays} days(28d), ${totalSlots28} slots(28d), next=${earliestDate ?? "none"}, days=${daysToFirst ?? "N/A"}, price: ${consultationPrice ?? "N/A"}`, progress);

  return {
    available_days_next_28_days: availableDays,
    available_slots_next_28_days: totalSlots28,
    avg_slots_per_day: avgSlotsPerDay,
    next_available_date: earliestDate,
    days_to_first_available: daysToFirst,
    consultation_price: consultationPrice,
    booking_state: bookingState,
  };
}

/**
 * Apply the polite API delay between sequential consultant API calls.
 */
export async function applyApiDelay(): Promise<void> {
  await sleep(API_DELAY_MS);
}

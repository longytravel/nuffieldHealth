import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally before importing the module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock config before importing booking
vi.mock("@/lib/config", () => ({
  APIM_SUBSCRIPTION_KEY: "test-key-123",
  API_DELAY_MS: 0,
  BOOKING_API_CONCURRENCY: 3,
  calculateRetryDelay: () => 0,
  MAX_RETRIES_429: 3,
  MAX_RETRIES_503: 2,
  MAX_RETRIES_5XX: 1,
  MAX_RETRIES_TIMEOUT: 2,
  BASE_DELAY_429_MS: 0,
  BASE_DELAY_503_MS: 0,
  BASE_DELAY_5XX_MS: 0,
  BASE_DELAY_TIMEOUT_MS: 0,
}));

// Mock logger to suppress output
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { fetchBookingData } from "./booking";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function notFoundResponse(): Response {
  return new Response("Not Found", { status: 404 });
}

// Helper to build clinicdays API response
function clinicDaysResponse(days: Array<{ date: string; locations: Array<{ hospitalCode: string; hospitalId: string; hospitalName: string }> }>) {
  return jsonResponse({
    gmcCode: "1234567",
    consultantName: "Mr Test",
    numberOfClinicDays: days.length,
    fromDate: "2026-02-28",
    span: 28,
    groupedBy: "date",
    results: days,
  });
}

// Helper to build slots API response
function slotsResponse(slots: Array<{ slotId: string; slotDate: string; slotTime: string; slotDuration: string }>) {
  return jsonResponse({
    uid: "test-uid",
    response: {
      status: "0000",
      statusText: "Successful",
      responseData: {
        gmcCode: "1234567",
        hospitalId: "hosp-1",
        departmentId: "",
        departmentText: "",
        specialty: "Test",
        bookingDetails: slots,
      },
    },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchBookingData", () => {
  it("should return not_bookable when clinicdays returns 404", async () => {
    mockFetch.mockResolvedValueOnce(notFoundResponse());

    const result = await fetchBookingData("1234567", "mr-test");

    expect(result.booking_state).toBe("not_bookable");
    expect(result.available_slots_next_28_days).toBe(0);
    expect(result.next_available_date).toBeNull();
    expect(result.consultation_price).toBeNull();
  });

  it("should aggregate slots across multiple hospitals", async () => {
    // clinicdays response with two dates at different hospitals
    mockFetch.mockResolvedValueOnce(
      clinicDaysResponse([
        { date: "2026-03-05", locations: [{ hospitalCode: "H1", hospitalId: "hosp-1", hospitalName: "Hospital 1" }] },
        { date: "2026-03-03", locations: [{ hospitalCode: "H2", hospitalId: "hosp-2", hospitalName: "Hospital 2" }] },
      ])
    );

    // slots for (2026-03-05, hosp-1)
    mockFetch.mockResolvedValueOnce(
      slotsResponse([
        { slotId: "s1", slotDate: "2026-03-05", slotTime: "10:00", slotDuration: "20" },
        { slotId: "s2", slotDate: "2026-03-05", slotTime: "11:00", slotDuration: "20" },
      ])
    );

    // slots for (2026-03-03, hosp-2)
    mockFetch.mockResolvedValueOnce(
      slotsResponse([
        { slotId: "s3", slotDate: "2026-03-03", slotTime: "09:00", slotDuration: "20" },
      ])
    );

    // pricing
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ price: 200 }])
    );

    const result = await fetchBookingData("1234567", "mr-test");

    expect(result.available_days_next_28_days).toBe(2); // 2 distinct dates
    expect(result.available_slots_next_28_days).toBe(3); // 2 + 1
    expect(result.avg_slots_per_day).toBe(1.5); // 3 / 2
    expect(result.next_available_date).toBe("2026-03-03"); // earliest
    expect(result.consultation_price).toBe(200);
    expect(result.booking_state).toBe("bookable_with_slots");
  });

  it("should return bookable_no_slots when clinicdays returns data but slots are empty", async () => {
    // clinicdays returns entries
    mockFetch.mockResolvedValueOnce(
      clinicDaysResponse([
        { date: "2026-03-05", locations: [{ hospitalCode: "H1", hospitalId: "hosp-1", hospitalName: "Hospital 1" }] },
      ])
    );

    // slots returns empty bookingDetails
    mockFetch.mockResolvedValueOnce(slotsResponse([]));

    // pricing returns 404
    mockFetch.mockResolvedValueOnce(notFoundResponse());

    const result = await fetchBookingData("1234567", "mr-test");

    expect(result.available_slots_next_28_days).toBe(0);
    expect(result.booking_state).toBe("bookable_no_slots");
    expect(result.consultation_price).toBeNull();
  });

  it("should handle pricing 404 gracefully", async () => {
    mockFetch.mockResolvedValueOnce(
      clinicDaysResponse([
        { date: "2026-03-10", locations: [{ hospitalCode: "H1", hospitalId: "hosp-1", hospitalName: "Hospital 1" }] },
      ])
    );
    mockFetch.mockResolvedValueOnce(
      slotsResponse([
        { slotId: "s1", slotDate: "2026-03-10", slotTime: "10:00", slotDuration: "20" },
      ])
    );
    mockFetch.mockResolvedValueOnce(notFoundResponse()); // pricing 404

    const result = await fetchBookingData("1234567", "mr-test");

    expect(result.consultation_price).toBeNull();
    expect(result.available_slots_next_28_days).toBe(1);
    expect(result.booking_state).toBe("bookable_with_slots");
  });

  it("should include APIM subscription key header in requests", async () => {
    mockFetch.mockResolvedValueOnce(notFoundResponse());

    await fetchBookingData("1234567", "mr-test");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("clinicdays/gmc/1234567"),
      expect.objectContaining({
        headers: { "Ocp-Apim-Subscription-Key": "test-key-123" },
      })
    );
  });

  it("should deduplicate date+hospital pairs from clinic days", async () => {
    // clinicdays returns two dates at same hospital — should produce 2 slot queries
    // Plus a date at a different hospital — 3 slot queries total
    mockFetch.mockResolvedValueOnce(
      clinicDaysResponse([
        { date: "2026-03-05", locations: [{ hospitalCode: "H1", hospitalId: "hosp-1", hospitalName: "Hospital 1" }] },
        { date: "2026-03-05", locations: [{ hospitalCode: "H1", hospitalId: "hosp-1", hospitalName: "Hospital 1" }] }, // duplicate
        { date: "2026-03-06", locations: [{ hospitalCode: "H2", hospitalId: "hosp-2", hospitalName: "Hospital 2" }] },
      ])
    );

    // Only 2 slot calls (deduplicated) + 1 pricing = 3 total follow-up calls
    mockFetch.mockResolvedValueOnce(slotsResponse([])); // slots (2026-03-05, hosp-1)
    mockFetch.mockResolvedValueOnce(slotsResponse([])); // slots (2026-03-06, hosp-2)
    mockFetch.mockResolvedValueOnce(notFoundResponse()); // pricing

    const result = await fetchBookingData("1234567", "mr-test");

    // clinicdays (1) + slots (2, deduplicated) + pricing (1) = 4 calls
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(result.booking_state).toBe("bookable_no_slots");
  });
});

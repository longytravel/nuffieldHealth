import { describe, it, expect, vi, beforeEach } from "vitest";
import { assessmentResponseSchema, NULL_ASSESSMENT } from "./assess";

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

vi.mock("@/lib/config", () => ({
  ANTHROPIC_API_KEY: "test-key",
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { assessProfile } from "./assess";

function makeValidResponse() {
  return {
    plain_english_score: 4,
    plain_english_reason: "Clear and accessible language",
    bio_depth: "substantive",
    bio_depth_reason: "Detailed background",
    treatment_specificity_score: "highly_specific",
    treatment_specificity_reason: "Named procedures",
    inferred_sub_specialties: ["Joint replacement"],
    personal_interests: "Golf",
    clinical_interests: ["Knee surgery"],
    languages: ["English", "French"],
    declaration_substantive: false,
    overall_quality_notes: "Strong profile",
  };
}

function makeApiResponse(data: unknown) {
  return {
    content: [
      { type: "text", text: JSON.stringify(data) },
    ],
  };
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe("assessmentResponseSchema", () => {
  it("should validate a correct response", () => {
    const valid = makeValidResponse();
    const result = assessmentResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should reject plain_english_score out of range", () => {
    const invalid = { ...makeValidResponse(), plain_english_score: 6 };
    const result = assessmentResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject invalid bio_depth value", () => {
    const invalid = { ...makeValidResponse(), bio_depth: "excellent" };
    const result = assessmentResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject invalid treatment_specificity_score value", () => {
    const invalid = { ...makeValidResponse(), treatment_specificity_score: "unknown" };
    const result = assessmentResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should accept null personal_interests", () => {
    const valid = { ...makeValidResponse(), personal_interests: null };
    const result = assessmentResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const invalid = { plain_english_score: 4 };
    const result = assessmentResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("assessProfile", () => {
  it("should return validated assessment on valid response", async () => {
    const validData = makeValidResponse();
    mockCreate.mockResolvedValueOnce(makeApiResponse(validData));

    const result = await assessProfile("Test profile text", "mr-test");

    expect(result.plain_english_score).toBe(4);
    expect(result.bio_depth).toBe("substantive");
    expect(result.languages).toEqual(["English", "French"]);
  });

  it("should handle markdown-wrapped JSON response", async () => {
    const validData = makeValidResponse();
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: "text", text: "```json\n" + JSON.stringify(validData) + "\n```" },
      ],
    });

    const result = await assessProfile("Test profile text", "mr-test");
    expect(result.plain_english_score).toBe(4);
  });

  it("should retry once on invalid response then succeed", async () => {
    // First call: invalid response
    mockCreate.mockResolvedValueOnce(
      makeApiResponse({ invalid: true })
    );

    // Second call: valid response
    const validData = makeValidResponse();
    mockCreate.mockResolvedValueOnce(makeApiResponse(validData));

    const result = await assessProfile("Test profile text", "mr-test");
    expect(result.plain_english_score).toBe(4);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("should return NULL_ASSESSMENT when both attempts fail", async () => {
    // Both calls return invalid data
    mockCreate.mockResolvedValueOnce(makeApiResponse({ invalid: true }));
    mockCreate.mockResolvedValueOnce(makeApiResponse({ still_invalid: true }));

    const result = await assessProfile("Test profile text", "mr-test");

    expect(result.plain_english_score).toBe(NULL_ASSESSMENT.plain_english_score);
    expect(result.bio_depth).toBe(NULL_ASSESSMENT.bio_depth);
    expect(result.overall_quality_notes).toContain("failed");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("should return NULL_ASSESSMENT when API throws an error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API error"));
    mockCreate.mockRejectedValueOnce(new Error("API error"));

    const result = await assessProfile("Test profile text", "mr-test");

    expect(result.bio_depth).toBe("missing");
    expect(result.overall_quality_notes).toContain("failed");
  });
});

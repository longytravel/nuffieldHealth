import { describe, expect, it } from "vitest";
import {
  isLikelySameConsultantName,
  normalizeNameForMatching,
  normalizeRegistrationNumber,
} from "./discover-bupa";

describe("normalizeNameForMatching", () => {
  it("normalizes BUPA sitemap slugs with underscores", () => {
    expect(normalizeNameForMatching("dr_adam_lawson")).toBe("adam lawson");
  });

  it("normalizes mixed punctuation consistently across sources", () => {
    expect(normalizeNameForMatching("Dr. Akeel Alisa")).toBe("akeel alisa");
    expect(normalizeNameForMatching("dr_akeel_alisa")).toBe("akeel alisa");
    expect(normalizeNameForMatching("Mr O'Connor-Smith")).toBe("oconnor smith");
  });
});

describe("isLikelySameConsultantName", () => {
  it("treats optional middle names as the same consultant", () => {
    expect(isLikelySameConsultantName("Dr Adam Lawson", "dr_adam_john_lawson")).toBe(true);
  });

  it("rejects different surnames", () => {
    expect(isLikelySameConsultantName("Dr Adam Lawson", "dr_adam_jones")).toBe(false);
  });
});

describe("normalizeRegistrationNumber", () => {
  it("removes non-digits and leading zeros", () => {
    expect(normalizeRegistrationNumber("02211202")).toBe("2211202");
    expect(normalizeRegistrationNumber("GMC 4428132")).toBe("4428132");
  });
});

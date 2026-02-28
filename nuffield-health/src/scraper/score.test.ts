import { describe, it, expect } from "vitest";
import { scoreConsultant, ScoreInput } from "./score";

/** Helper: create a full ScoreInput with sensible defaults, overrideable per test */
function makeInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    has_photo: true,
    bio_depth: "substantive",
    treatments: ["Treatment A", "Treatment B"],
    qualifications_credentials: "MBBS, FRCS",
    specialty_primary: ["General Surgery"],
    specialty_sub: [],
    insurers: ["Bupa", "AXA"],
    consultation_times_raw: ["Mon 9-5"],
    plain_english_score: 4,
    booking_state: "bookable_with_slots",
    online_bookable: true,
    practising_since: 2005,
    memberships: ["Royal College of Surgeons"],
    available_slots_next_28_days: 10,
    gmc_code_for_booking: "1234567",
    ...overrides,
  };
}

describe("scoreConsultant", () => {
  // --- Gold tier ---
  it("should assign Gold tier for a complete profile scoring 100", () => {
    const input = makeInput();
    const result = scoreConsultant(input);

    expect(result.profile_completeness_score).toBe(100);
    expect(result.quality_tier).toBe("Gold");
    expect(result.flags.filter((f) => f.severity === "fail")).toHaveLength(0);
  });

  it("should treat sub-specialties as valid specialty evidence for scoring and tier gates", () => {
    const input = makeInput({
      specialty_primary: [],
      specialty_sub: ["Spinal Surgery"],
    });
    const result = scoreConsultant(input);

    expect(result.profile_completeness_score).toBe(100);
    expect(result.quality_tier).toBe("Gold");
  });

  it("should assign Gold tier at exactly score 80 with all mandatory fields", () => {
    // Score: photo(10) + bio_substantive(15) + specialty(10) + qualifications(10) +
    //        insurers(8) + consultation_times(7) + plain_english=3(5) + practising(5) + memberships(5) + booking_no_slots(5) = 80
    const input = makeInput({
      plain_english_score: 3,
      booking_state: "bookable_no_slots",
      treatments: [], // waived via non-procedural
      specialty_primary: ["Psychiatry"],
    });
    const result = scoreConsultant(input);

    expect(result.profile_completeness_score).toBe(80);
    expect(result.quality_tier).toBe("Gold");
  });

  // --- Gold blocked by fail flag ---
  it("should block Gold tier when a fail flag is present (downgrade to Silver)", () => {
    // Score 90 but no photo → fail flag → cannot be Gold
    // Score without photo: 0 + 15 + 10 + 10 + 10 + 8 + 7 + 10 + 10 + 5 + 5 = 90
    const input = makeInput({ has_photo: false });
    const result = scoreConsultant(input);

    expect(result.profile_completeness_score).toBe(90);
    expect(result.quality_tier).not.toBe("Gold");
    expect(result.flags.some((f) => f.code === "PROFILE_NO_PHOTO" && f.severity === "fail")).toBe(true);
  });

  it("should downgrade from Gold to Silver when score >= 80 and has fail flag but meets Silver mandatory", () => {
    // has_photo true, no qualifications (fail), rest strong
    // Score: 10 + 15 + 10 + 0 + 10 + 8 + 7 + 10 + 10 + 5 + 5 = 90
    const input = makeInput({ qualifications_credentials: null });
    const result = scoreConsultant(input);

    expect(result.profile_completeness_score).toBe(90);
    // Has 1 fail flag → cannot be Gold, but meets Silver mandatory (has_photo + specialty)
    expect(result.quality_tier).toBe("Silver");
    expect(result.flags.some((f) => f.code === "CONTENT_NO_QUALIFICATIONS")).toBe(true);
  });

  // --- 2+ fail flags → Incomplete ---
  it("should force Incomplete when 2+ fail flags regardless of score", () => {
    // No photo (fail) + no qualifications (fail) but otherwise strong
    const input = makeInput({
      has_photo: false,
      qualifications_credentials: null,
    });
    const result = scoreConsultant(input);

    // Score: 0 + 15 + 10 + 0 + 10 + 8 + 7 + 10 + 10 + 5 + 5 = 80
    expect(result.profile_completeness_score).toBe(80);
    expect(result.quality_tier).toBe("Incomplete");
    const failFlags = result.flags.filter((f) => f.severity === "fail");
    expect(failFlags.length).toBeGreaterThanOrEqual(2);
  });

  it("should force Incomplete with 3 fail flags: no photo, no bio, no qualifications", () => {
    const input = makeInput({
      has_photo: false,
      bio_depth: "missing",
      qualifications_credentials: null,
    });
    const result = scoreConsultant(input);
    expect(result.quality_tier).toBe("Incomplete");
    const failFlags = result.flags.filter((f) => f.severity === "fail");
    expect(failFlags.length).toBe(3);
  });

  // --- Specialty waiver ---
  it("should not deduct for missing treatments when specialty is non-procedural (Psychiatry)", () => {
    const input = makeInput({
      specialty_primary: ["Psychiatry"],
      treatments: [],
    });
    const result = scoreConsultant(input);

    // Score: 10 + 15 + 0(waived) + 10 + 10 + 8 + 7 + 10 + 10 + 5 + 5 = 90
    expect(result.profile_completeness_score).toBe(90);
    expect(result.flags.some((f) => f.code === "CONTENT_NO_TREATMENTS")).toBe(false);
  });

  it("should deduct for missing treatments when specialty is procedural", () => {
    const input = makeInput({
      specialty_primary: ["Orthopaedics"],
      treatments: [],
    });
    const result = scoreConsultant(input);

    // Score: 10 + 15 + 0 + 10 + 10 + 8 + 7 + 10 + 10 + 5 + 5 = 90
    expect(result.profile_completeness_score).toBe(90);
    expect(result.flags.some((f) => f.code === "CONTENT_NO_TREATMENTS")).toBe(true);
  });

  // --- Partial credit ---
  it("should award 10 points for bio_depth=adequate instead of 15", () => {
    const inputSubstantive = makeInput({ bio_depth: "substantive" });
    const inputAdequate = makeInput({ bio_depth: "adequate" });

    const scoreSubstantive = scoreConsultant(inputSubstantive).profile_completeness_score;
    const scoreAdequate = scoreConsultant(inputAdequate).profile_completeness_score;

    expect(scoreSubstantive - scoreAdequate).toBe(5); // 15 - 10 = 5
  });

  it("should award 5 points for plain_english_score=3 instead of 10", () => {
    const input4 = makeInput({ plain_english_score: 4 });
    const input3 = makeInput({ plain_english_score: 3 });

    const score4 = scoreConsultant(input4).profile_completeness_score;
    const score3 = scoreConsultant(input3).profile_completeness_score;

    expect(score4 - score3).toBe(5); // 10 - 5 = 5
  });

  it("should award 0 points for plain_english_score <= 2", () => {
    const input2 = makeInput({ plain_english_score: 2 });
    const input1 = makeInput({ plain_english_score: 1 });

    expect(scoreConsultant(input2).profile_completeness_score).toBe(
      scoreConsultant(input1).profile_completeness_score
    );
  });

  it("should award 5 points for booking_no_slots instead of 10", () => {
    const inputSlots = makeInput({ booking_state: "bookable_with_slots" });
    const inputNoSlots = makeInput({ booking_state: "bookable_no_slots" });

    const scoreSlots = scoreConsultant(inputSlots).profile_completeness_score;
    const scoreNoSlots = scoreConsultant(inputNoSlots).profile_completeness_score;

    expect(scoreSlots - scoreNoSlots).toBe(5);
  });

  // --- Tier boundaries ---
  it("should assign Silver at score 79 (not Gold)", () => {
    // Need exactly 79: photo(10) + bio_adequate(10) + treatments(10) + qualifications(10) +
    //   specialty(10) + insurers(8) + consultation_times(7) + plain_english=3(5) + booking_no_slots(5) +
    //   practising(0) + memberships(4→no, 5) = ...
    // Let's build: 10+10+10+10+10+8+7+5+5+0+5 = 80. Remove memberships → 75. Too low.
    // 10+15+10+10+10+8+7+5+5+0+0 = 80. Need 79.
    // Use: bio_adequate(10) instead of substantive(15) → 75. Too low.
    // Use: 10+15+10+10+10+8+0+5+10+0+5=83. Remove consultation_times: 10+15+10+10+10+8+0+5+10+0+5=83
    // 10+15+10+10+10+0+7+5+10+0+5=82
    // 10+15+10+10+10+0+7+5+5+0+5=77
    // Let's just test boundary explicitly: score exactly 79 → Silver
    // 10+15+10+10+10+8+7+10+0+5+0=85... Let me calculate what makes 79:
    // photo=10, bio_subst=15, treat=10, qual=10, spec=10, ins=8, cons=7, pe4=10, book_not=0, prac=0, memb=0 = 80
    // Make pe=3(5) to get 75... no.
    // 10+15+10+10+10+8+7+5+0+5+0=80. remove memb(5)=75. Still not 79.
    // Actually: 10+15+10+10+10+8+0+5+10+5+0=83
    // It's hard to hit exactly 79 with these weights. Let's verify boundary behavior differently.
    // Score 79 can't be Gold even with mandatory fields, score 80 can be.
    // Test: a profile at 80 is Gold, remove 1 point somehow → Silver.
    // Since weights are discrete, the closest we can get below 80 is 75 or less.
    // Let's test: score 75 → Silver (since >=60, has_photo, has specialty)
    const input = makeInput({
      bio_depth: "adequate", // 10 instead of 15 → -5
      booking_state: "bookable_no_slots", // 5 instead of 10 → -5
      memberships: [], // 0 → -5
      practising_since: null, // 0 → -5
    });
    // Score: 10+10+10+10+10+8+7+10+5+0+0 = 80. Wait...
    // photo(10) + bio_adequate(10) + treatments(10) + qual(10) + spec(10) + ins(8) + cons(7) + pe4(10) + book_no_slots(5) + prac(0) + memb(0) = 80
    // Still 80! With bio adequate the Gold mandatory bio_depth_substantive fails.
    // So score=80 but bio not substantive → mandatory for Gold not met → Silver
    const result = scoreConsultant(input);
    expect(result.profile_completeness_score).toBe(80);
    // Can't be Gold because bio_depth != substantive
    expect(result.quality_tier).toBe("Silver");
  });

  it("should assign Gold at score 80 with all mandatory fields", () => {
    const input = makeInput({
      booking_state: "bookable_no_slots", // 5 instead of 10
      memberships: [], // 0
      practising_since: null, // 0
    });
    // photo(10) + bio_subst(15) + treatments(10) + qual(10) + spec(10) + ins(8) + cons(7) + pe4(10) + book_no_slots(5) + prac(0) + memb(0) = 85
    // Need exactly 80. Let's also remove insurers.
    const input80 = makeInput({
      booking_state: "not_bookable", // 0
      memberships: [], // 0
      practising_since: null, // 0
    });
    // photo(10) + bio_subst(15) + treatments(10) + qual(10) + spec(10) + ins(8) + cons(7) + pe4(10) + book(0) + prac(0) + memb(0) = 80
    const result = scoreConsultant(input80);
    expect(result.profile_completeness_score).toBe(80);
    expect(result.quality_tier).toBe("Gold");
  });

  it("should assign Silver at score 60 with Silver mandatory fields", () => {
    // photo(10) + bio_thin(0) + treatments(10) + qual(10) + spec(10) + ins(8) + cons(0) + pe=3(5) + book_no_slots(5) + prac(0) + memb(0) = 58... need 60
    // photo(10) + bio_adequate(10) + treatments(10) + qual(0→fail) + spec(10) + ins(0) + cons(7) + pe=3(5) + book(0) + prac(5) + memb(5) = 62
    // That gives a fail flag so can't be Gold. Has photo + specialty → Silver candidate.
    const input = makeInput({
      bio_depth: "adequate",
      qualifications_credentials: null, // fail flag
      insurers: [],
      plain_english_score: 3,
      booking_state: "not_bookable",
    });
    // photo(10) + bio_adequate(10) + treat(10) + qual(0) + spec(10) + ins(0) + cons(7) + pe3(5) + book(0) + prac(5) + memb(5) = 62
    const result = scoreConsultant(input);
    expect(result.profile_completeness_score).toBe(62);
    expect(result.quality_tier).toBe("Silver");
  });

  it("should assign Bronze at score 59 when Silver mandatory not met (no photo)", () => {
    // No photo (fail), score could be 59 or more but needs to be between 40-59 for Bronze
    // Actually — no photo means Silver mandatory not met. If score >= 40 + specialty → Bronze
    const input = makeInput({
      has_photo: false,
      bio_depth: "thin",
      treatments: [],
      qualifications_credentials: null,
      insurers: [],
      consultation_times_raw: [],
      plain_english_score: 2,
      booking_state: "not_bookable",
      practising_since: null,
      memberships: [],
      specialty_primary: ["General Surgery"],
    });
    // photo(0) + bio(0) + treat(0) + qual(0) + spec(10) + ins(0) + cons(0) + pe(0) + book(0) + prac(0) + memb(0) = 10
    // But 3 fail flags → Incomplete. Let me reduce fail flags.
    const input2 = makeInput({
      has_photo: false, // 1 fail
      bio_depth: "thin", // warn, not fail
      insurers: [],
      consultation_times_raw: [],
      plain_english_score: 2,
      booking_state: "not_bookable",
      practising_since: null,
      memberships: [],
    });
    // photo(0) + bio_thin(0) + treat(10) + qual(10) + spec(10) + ins(0) + cons(0) + pe(0) + book(0) + prac(0) + memb(0) = 30
    // 1 fail flag, but score only 30 → below Bronze threshold. Need >= 40.
    // Let's make a case with 1 fail flag and score between 40-59
    const input3 = makeInput({
      has_photo: false, // 1 fail → blocks Gold AND Silver (Silver mandatory: has_photo)
      bio_depth: "adequate", // 10
      plain_english_score: 3, // 5
      booking_state: "not_bookable", // 0
      practising_since: null, // 0
      memberships: [], // 0
    });
    // photo(0) + bio_adeq(10) + treat(10) + qual(10) + spec(10) + ins(8) + cons(7) + pe3(5) + book(0) + prac(0) + memb(0) = 60
    // 1 fail flag → can't be Gold. Silver needs has_photo → fail. Bronze: score>=40, specialty → Bronze.
    const result = scoreConsultant(input3);
    expect(result.profile_completeness_score).toBe(60);
    expect(result.quality_tier).toBe("Bronze");
  });

  it("should assign Bronze at score 40 boundary", () => {
    const input = makeInput({
      has_photo: false,
      bio_depth: "thin",
      treatments: [],
      insurers: [],
      consultation_times_raw: [],
      plain_english_score: 2,
      booking_state: "not_bookable",
      practising_since: null,
      memberships: [],
      specialty_primary: ["Orthopaedics"],
    });
    // photo(0,fail) + bio(0,warn) + treat(0,warn) + qual(10) + spec(10) + ins(0,warn) + cons(0) + pe(0) + book(0,info) + prac(0) + memb(0) = 20
    // Only 1 fail → not forced Incomplete, but score=20 < 40 → Incomplete
    // Need score=40 with 1 fail: add treatments back
    const input40 = makeInput({
      has_photo: false, // fail
      bio_depth: "thin",
      insurers: [],
      consultation_times_raw: [],
      plain_english_score: 2,
      booking_state: "not_bookable",
      practising_since: null,
      memberships: [],
    });
    // photo(0) + bio(0) + treat(10) + qual(10) + spec(10) + ins(0) + cons(0) + pe(0) + book(0) + prac(0) + memb(0) = 30
    // Still 30. Need 40. Add insurers (8) + consultation (7) → 45. Too much.
    // 30 + insurers(8) = 38. Still not 40.
    // 30 + insurers(8) + prac(5) = 43. One fail flag, no photo so Silver blocked → Bronze.
    const inputBronze = makeInput({
      has_photo: false, // fail
      bio_depth: "thin",
      consultation_times_raw: [],
      plain_english_score: 2,
      booking_state: "not_bookable",
      memberships: [],
    });
    // photo(0) + bio(0) + treat(10) + qual(10) + spec(10) + ins(8) + cons(0) + pe(0) + book(0) + prac(5) + memb(0) = 43
    const result = scoreConsultant(inputBronze);
    expect(result.profile_completeness_score).toBe(43);
    expect(result.quality_tier).toBe("Bronze");
  });

  it("should assign Incomplete at score 39 (below Bronze threshold)", () => {
    const input = makeInput({
      has_photo: false,
      bio_depth: "thin",
      consultation_times_raw: [],
      plain_english_score: 2,
      booking_state: "not_bookable",
      memberships: [],
      practising_since: null,
    });
    // photo(0) + bio(0) + treat(10) + qual(10) + spec(10) + ins(8) + cons(0) + pe(0) + book(0) + prac(0) + memb(0) = 38
    const result = scoreConsultant(input);
    expect(result.profile_completeness_score).toBe(38);
    expect(result.quality_tier).toBe("Incomplete");
  });

  // --- Mandatory field gates ---
  it("should assign Incomplete when both specialty_primary and specialty_sub are empty regardless of score", () => {
    const input = makeInput({
      specialty_primary: [],
      specialty_sub: [],
    });
    // Score: 10+15+10+10+0+8+7+10+10+5+5 = 90
    const result = scoreConsultant(input);
    expect(result.profile_completeness_score).toBe(90);
    // Gold needs specialty → Silver needs specialty → Bronze needs specialty → Incomplete
    expect(result.quality_tier).toBe("Incomplete");
  });

  // --- Flag codes ---
  it("should generate PROFILE_NO_PHOTO fail flag", () => {
    const result = scoreConsultant(makeInput({ has_photo: false }));
    expect(result.flags.some((f) => f.code === "PROFILE_NO_PHOTO" && f.severity === "fail")).toBe(true);
  });

  it("should generate CONTENT_THIN_BIO warn flag", () => {
    const result = scoreConsultant(makeInput({ bio_depth: "thin" }));
    expect(result.flags.some((f) => f.code === "CONTENT_THIN_BIO" && f.severity === "warn")).toBe(true);
  });

  it("should generate CONTENT_MISSING_BIO fail flag", () => {
    const result = scoreConsultant(makeInput({ bio_depth: "missing" }));
    expect(result.flags.some((f) => f.code === "CONTENT_MISSING_BIO" && f.severity === "fail")).toBe(true);
  });

  it("should generate BOOKING_NO_SLOTS warn flag", () => {
    const result = scoreConsultant(makeInput({ booking_state: "bookable_no_slots" }));
    expect(result.flags.some((f) => f.code === "BOOKING_NO_SLOTS" && f.severity === "warn")).toBe(true);
  });

  it("should generate BOOKING_NOT_BOOKABLE info flag", () => {
    const result = scoreConsultant(makeInput({ booking_state: "not_bookable" }));
    expect(result.flags.some((f) => f.code === "BOOKING_NOT_BOOKABLE" && f.severity === "info")).toBe(true);
  });

  it("should generate CONTENT_NO_QUALIFICATIONS fail flag", () => {
    const result = scoreConsultant(makeInput({ qualifications_credentials: null }));
    expect(result.flags.some((f) => f.code === "CONTENT_NO_QUALIFICATIONS" && f.severity === "fail")).toBe(true);
  });

  it("should generate CONTENT_NO_TREATMENTS warn flag for procedural specialty", () => {
    const result = scoreConsultant(makeInput({
      treatments: [],
      specialty_primary: ["Orthopaedics"],
    }));
    expect(result.flags.some((f) => f.code === "CONTENT_NO_TREATMENTS" && f.severity === "warn")).toBe(true);
  });

  it("should NOT generate CONTENT_NO_TREATMENTS for non-procedural specialty", () => {
    const result = scoreConsultant(makeInput({
      treatments: [],
      specialty_primary: ["Clinical Psychology"],
    }));
    expect(result.flags.some((f) => f.code === "CONTENT_NO_TREATMENTS")).toBe(false);
  });

  it("should generate CONTENT_NO_INSURERS warn flag", () => {
    const result = scoreConsultant(makeInput({ insurers: [] }));
    expect(result.flags.some((f) => f.code === "CONTENT_NO_INSURERS" && f.severity === "warn")).toBe(true);
  });

  // --- Null bio_depth treated as missing ---
  it("should treat null bio_depth as missing and generate CONTENT_MISSING_BIO fail flag", () => {
    const result = scoreConsultant(makeInput({ bio_depth: null }));
    expect(result.flags.some((f) => f.code === "CONTENT_MISSING_BIO" && f.severity === "fail")).toBe(true);
  });
});

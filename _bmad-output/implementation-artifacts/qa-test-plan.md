# QA Test Plan: Consultant Profile Scraper

**Version:** 1.0
**Date:** 2026-02-28
**Phase:** Data Quality Validation
**Owner:** ROG

---

## Objective

Validate that the scraper produces accurate, complete, and consistent data across the full range of profile structures on nuffieldhealth.com. Every data point in the output must be verifiable against the live profile.

---

## Test Phases

### Phase 1: Ground Truth Cohort (30 profiles)

**Goal:** Establish a verified baseline — human-checked field-by-field accuracy.

**Method:**
1. Select 30 profiles from the sitemap covering known edge cases and diversity
2. Run the scraper against each profile individually (`--slug`)
3. Manually compare every extracted field against the live page
4. Record accuracy per field in a results matrix
5. Log any new bugs as BUG-008+

**Profile selection criteria (aim for 30 covering all of these):**

| Category | Count | Why |
|----------|-------|-----|
| Full-featured profiles (10+ H2s, all sections present) | 6 | Verify complete extraction |
| Sparse profiles (5-7 H2s, many sections absent) | 4 | Verify null handling |
| Non-bookable profiles (no booking iframe) | 3 | Verify booking_state logic |
| Profiles with known edge cases from spec validation | 5 | Regression — Miss/Ms titles, cosmetic headings, CMS corruption |
| Non-Nuffield primary hospital | 2 | Verify hospital_is_nuffield logic |
| Wales/Scotland hospitals (no CQC) | 2 | Verify cqc_rating null handling |
| Profiles with substantive declarations | 2 | Verify declaration_substantive |
| Profiles with patient age restrictions | 2 | Verify age restriction parsing |
| Paediatric-only consultant | 1 | Verify age range extraction |
| Profile with middle initial in name | 1 | Verify name parsing |
| Profile with external website | 1 | Verify URL capture |
| Profile with mobile number | 1 | Verify contact_mobile capture |

**Suggested profiles (reuse spec validation URLs where applicable):**
- From R6: `miss-caroline-cheadle`, `ms-kallirroi-tzafetta`, `mr-ashok-rajimwale`
- From R5: `dr-alexandra-stewart`, `mr-chris-little`, `dr-astor-rodrigues`
- From R4: `dr-emma-mcgrath`, `professor-christof-kastner`, `professor-marios-papadopoulos`
- From R3: `professor-rajesh-nanda`, `mr-gans-thiagamoorthy`
- Plus 19 new random profiles from sitemap

**Pass criteria:**
- Deterministic fields: >= 99% accuracy (at most 1 field error across 30 profiles x 40+ fields)
- AI-assessed fields: >= 90% reviewer agreement
- Zero new critical bugs

**Deliverable:** Ground truth results matrix + new bug reports if any

---

### Phase 2: Broader Accuracy Test (200 profiles)

**Goal:** Stress test the parser against structural diversity at scale.

**Method:**
1. Sample 200 random profiles from sitemap (no overlap with Phase 1)
2. Run scraper in batch
3. Automated checks (no manual field-by-field review at this scale):
   - Every record has the expected shape (all fields present, correct types)
   - No `undefined` values anywhere
   - `consultant_name` is not cookie banner text (no "Your choice" / "cookies")
   - `specialty_primary` has no label prefixes ("Sub-specialties:")
   - `registration_number` is non-empty for all active profiles
   - `profile_completeness_score` is 0-100
   - `quality_tier` is one of Gold/Silver/Bronze/Incomplete
   - `flags` array contains valid flag objects with code/severity/message
   - `booking_state` is one of the three valid enum values
   - All timestamps are valid ISO 8601
   - No `hospital_name_primary` contains CTA/form content
4. Spot-check 20 random profiles manually against live page (quick check, not field-by-field)
5. Measure distribution: tier breakdown, flag frequency, field population rates

**Pass criteria:**
- Zero schema validation failures
- Zero automated check failures
- Spot-check: no critical data errors
- Tier distribution is plausible (not all Incomplete, not all Gold)

**Deliverable:** Automated check results + distribution summary + spot-check notes

---

### Phase 3: Full Run (all ~3,800 profiles)

**Goal:** Prove the system completes a full run without manual intervention.

**Method:**
1. Run full pipeline: `npx tsx src/scraper/run.ts`
2. Monitor for crashes, hangs, or uncaught errors
3. After completion, check:
   - `scrape_runs` table has a `complete` status
   - `success_count` + `error_count` = `total_profiles`
   - Error rate is < 5% (most errors should be 404s / genuinely deleted profiles)
   - HTML cache directory has files for all successful profiles
   - Resume works: kill mid-run, restart with `--resume`, verify it picks up where it left off
4. Generate the full dataset and run Phase 2 automated checks against it
5. Dashboard loads and displays data correctly

**Pass criteria:**
- Run completes without manual intervention
- Error rate < 5%
- Resume/retry works correctly
- Dashboard renders all pages without errors
- CSV export produces valid output

**Deliverable:** Full run report (timing, error rate, tier distribution, top flags)

---

### Phase 4: Booking API Validation (subset)

**Goal:** Verify booking data accuracy for bookable consultants.

**Method:**
1. Select 15 bookable consultants from Phase 1/2 results
2. For each, compare scraper output against:
   - Live booking widget on the profile page (slots available? price shown?)
   - Direct API call responses (manual curl with APIM key)
3. Check:
   - `booking_state` matches reality (bookable vs not)
   - `available_slots_next_28_days` is in the right ballpark
   - `consultation_price` matches the displayed price
   - `next_available_date` is accurate

**Pass criteria:**
- `booking_state` correct for 15/15
- Price matches for 13/15 (allowing for real-time changes)
- Slot counts within 20% of manual check (availability changes constantly)

**Deliverable:** Booking accuracy matrix

---

### Phase 5: AI Assessment Validation (subset)

**Goal:** Verify the AI quality scores are reasonable and consistent.

**Method:**
1. Take 20 profiles from Phase 1 ground truth cohort
2. For each, independently read the profile and score:
   - `plain_english_score` (1-5)
   - `bio_depth` (substantive/adequate/thin/missing)
   - `treatment_specificity_score`
3. Compare human assessment vs. Haiku output
4. Check for obvious errors (e.g. missing bio scored as "substantive")

**Pass criteria:**
- >= 90% agreement on `bio_depth` (18/20)
- `plain_english_score` within 1 point for 90% of profiles
- Zero cases where AI returns obviously wrong assessment

**Deliverable:** AI agreement matrix + disagreement analysis

---

## Bug Tracking

All bugs follow the format in `nuffield-health/bugs/`:

```
BUG-{NNN}.md
- Severity: Critical / Moderate / Minor
- Status: Open / Fixed / Won't Fix
- Found in: Phase and profile
- Description, root cause, fix, test added
```

Bugs discovered in testing feed back into the test suite as regression tests.

---

## Test Execution Order

```
Phase 1 (Ground Truth)          ← START HERE
    ↓
Phase 5 (AI Validation)         ← Can run alongside Phase 1
    ↓
Phase 2 (200 Profile Stress)    ← After Phase 1 bugs are fixed
    ↓
Phase 4 (Booking Validation)    ← After Phase 2 confirms stability
    ↓
Phase 3 (Full Run)              ← Final validation
```

---

## Current Test Status

| Phase | Status | Result |
|-------|--------|--------|
| Pre-testing: Single profile scrape | Complete | 7 bugs found, all fixed |
| Phase 1: Ground Truth (30 profiles) | Not started | — |
| Phase 2: 200 Profile Stress | Not started | — |
| Phase 3: Full Run | Not started | — |
| Phase 4: Booking Validation | Not started | — |
| Phase 5: AI Validation | Not started | — |

## Unit Test Status

- **140 tests** passing (Vitest)
- Coverage: parse.ts (117 + 23 bug fix tests), score.ts, booking.ts, assess.ts

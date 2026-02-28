# Changelog

All notable changes to the Nuffield Health Consultant Profile Scraper.

Bug reports with full root cause analysis and spec cross-references are in `_bmad-output/implementation-artifacts/bug-reports/`.

## [Unreleased] - 2026-02-28

### Bug Fixes (QA Pre-testing — Live Scrape Round 1)

7 bugs discovered from first live scrape of `professor-stephen-mcdonnell`. All fixed and verified.

| Bug | Severity | Summary | Impact |
|-----|----------|---------|--------|
| BUG-001 | Critical | Cookie banner H1 captured as consultant name | Name field completely wrong |
| BUG-002 | Moderate | Specialty array includes label prefix and trailing commas | Dirty data in specialty fields |
| BUG-003 | Moderate | Hospital name grabs CTA form content | Wrong hospital name |
| BUG-004 | Moderate | practising_since null despite year present | Missing data, score penalty |
| BUG-005 | Minor | Declaration falsely flagged as substantive | Incorrect flag |
| BUG-006 | Moderate | AI failure masks bio_depth with "missing" | Score dropped Silver/65 instead of Gold/80 |
| BUG-007 | Minor | external_website captures nuffieldhealthcareers.com | False external link |

### Verification

Re-scraped `professor-stephen-mcdonnell` — all 7 fields verified correct. Quality score: Silver/65 → Gold/80.

### Files Changed

- `src/scraper/parse.ts` — BUG-001 through BUG-007
- `src/scraper/run.ts` — BUG-006 (heuristic fallback)
- `src/scraper/parse.test.ts` — 23 new regression tests (140 total)

### Bug Fixes (QA Phase 1 — Ground Truth, 30-profile cohort)

5 bugs discovered from 30-profile ground truth run. All fixed and verified.

| Bug | Severity | Summary | Impact |
|-----|----------|---------|--------|
| BUG-008 | Moderate | Double spaces in consultant names | 5/30 names had extra whitespace |
| BUG-009 | Critical | Age restriction parsing garbled — matched phone numbers | 9/11 non-null values wrong |
| BUG-010 | Critical | hospital_is_nuffield always false | 30/30 wrong |
| BUG-011 | Critical | booking_state overwritten to not_bookable by API failure | 22/30 affected |
| BUG-012 | Moderate | CQC rating never captured — regex missed live page format | 30/30 null |

### Files Changed

- `src/scraper/parse.ts` — BUG-008 (whitespace normalisation), BUG-009 (age restriction scoping + stricter regex), BUG-010 (hospital_is_nuffield default true), BUG-012 (CQC regex broadened)
- `src/scraper/run.ts` — BUG-011 (booking fallback preserves page-detected bookability)
- `src/scraper/parse.test.ts` — 17 new regression tests (157 total)

### Bug Fixes (QA Phase 1 — 10-profile random spot-check)

2 bugs discovered from manual spot-check of 10 random profiles against live pages. All fixed and verified.

| Bug | Severity | Summary | Impact |
|-----|----------|---------|--------|
| BUG-013 | Moderate | Central booking tel: link captured instead of hospital phone | 2/10 profiles had wrong phone (central Leeds number) |
| BUG-014 | Minor | PHONE_REGEX doesn't match London 020 numbers | 1/10 profiles had null phone despite number being on page |

### Files Changed

- `src/scraper/parse.ts` — BUG-013 (prefer itemprop="telephone" over tel: links), BUG-014 (PHONE_REGEX handles 3-digit area codes)
- `src/scraper/parse.test.ts` — 4 new regression tests (161 total)

### Bug Fixes (QA Phase 2 — 12-profile live spot-check)

1 bug discovered from QA team spot-checking 12 random profiles against live pages. Fixed and verified.

| Bug | Severity | Summary | Impact |
|-----|----------|---------|--------|
| BUG-016 | Medium | Hospital name captures form CTA text on profiles with no location section | Profiles with no hospital assignment get "Ask a question about this consultant..." as hospital name |

### Schema Fix

| Change | Summary |
|--------|---------|
| consultation_price type | Changed from `text` to `real` across full chain (schema, booking.ts, run.ts, validators.ts) for numeric aggregation (AVG, MIN, MAX) |

### Files Changed

- `src/scraper/parse.ts` — BUG-016 (remove broad `[class*='hospital']` from fallback selector)
- `src/scraper/parse.test.ts` — 3 new regression tests (BUG-016: no location section, broad selector, location present with form)
- `src/db/schema.ts` — consultation_price: text → real
- `src/scraper/booking.ts` — consultation_price: string → number throughout
- `src/scraper/run.ts` — consultation_price type annotations updated
- `src/lib/validators.ts` — consultation_price: z.string() → z.number()
- `src/scraper/booking.test.ts` — price expectation: "200" → 200
- Test count: 174 → 177 (3 new tests)

### AI Assessment Evidence & Quality Improvements (Quick Spec v1.8)

Implements spec §3.5 (AI Assessment Evidence Fields), expanded §5 (Haiku Prompt Contract), and BUG-015 fix.

| Change | Summary |
|--------|---------|
| BUG-015 | "Browser doesn't support frames" iframe artifact stripped from about_text, overview_text, related_experience_text |
| Evidence persistence | All AI reason fields now persisted: plain_english_reason, bio_depth_reason, treatment_specificity_reason, qualifications_completeness_reason, ai_quality_notes |
| New field: qualifications_completeness | Enum (comprehensive/adequate/minimal/missing) — AI-assessed, persisted to DB |
| New field: professional_interests | Nullable string — AI-extracted, persisted to DB |
| Schema migration | 7 new columns added to consultants table |

### Files Changed

- `src/db/schema.ts` — 7 new columns (§3.5 evidence fields + professional_interests)
- `src/scraper/assess.ts` — Zod schema expanded, NULL_ASSESSMENT updated, system prompt updated
- `src/scraper/run.ts` — persist all reason fields + professional_interests + ai_quality_notes
- `src/scraper/parse.ts` — BUG-015 (stripRenderingArtifacts for iframe noscript artifacts)
- `src/scraper/assess.test.ts` — 5 new tests (qualifications_completeness, professional_interests, NULL_ASSESSMENT validation)
- `src/scraper/parse.test.ts` — 8 new regression tests (stripRenderingArtifacts + parseProfile integration)
- `drizzle/0001_yummy_martin_li.sql` — migration file (10 ALTER TABLE ADD COLUMN)
- Test count: 161 → 174 (13 new tests)

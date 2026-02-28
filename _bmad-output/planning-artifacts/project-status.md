# Project Status: Nuffield Health Consultant Profile Quality Scraper

**Last updated:** 2026-02-28
**Current phase:** QA Testing
**Owner:** ROG

---

## Artifact Map

### Planning Artifacts (`_bmad-output/planning-artifacts/`)

| Artifact | File | Status |
|----------|------|--------|
| Quick Spec (v1.6) | `quick-spec-consultant-profile-scraper.md` | Complete — 6 validation rounds, 58 profiles |
| Architecture Doc | `architecture.md` | Complete — all decisions resolved |
| Project Status | `project-status.md` | Active — this document |
| Index | `index.md` | Complete |

### Implementation Artifacts (`_bmad-output/implementation-artifacts/`)

| Artifact | File | Status |
|----------|------|--------|
| QA Test Plan | `qa-test-plan.md` | Active — 5 phases defined, Phase 1 complete |
| Bug Reports | `bug-reports/BUG-001.md` through `BUG-014.md` | 14 found, 14 fixed, 0 open |
| Test Results | `test-results/phase-1-ground-truth.md` | Phase 1 complete — 30 profiles, 5 new bugs |
| Index | `index.md` | Complete |

### Code Repository (`nuffield-health/`)

| Artifact | File | Status |
|----------|------|--------|
| Application Code | `src/` | Built — scraper + dashboard |
| Unit Tests | `src/scraper/*.test.ts` | 161 tests passing |
| Changelog | `CHANGELOG.md` | Tracking releases and fixes |
| Project README | `README.md` | Complete |

### Project Root

| Artifact | File | Status |
|----------|------|--------|
| CLAUDE.md | `CLAUDE.md` | Complete — AI agent briefing |

---

## Phase Summary

### 1. Planning (Complete)

Quick spec created through 6 iterative validation rounds against live profiles:

| Round | Profiles | Key Findings |
|-------|----------|-------------|
| R1 | 8 | Initial assumptions corrected from live observations |
| R2 | 10 | Declaration section, consultation time variability, booking iframe |
| R3 | 10 + 120 scan | Sitemap as primary source, APIM auth, alphanumeric registration IDs |
| R4 | 10 | Professional Roles heading, H2/H3 level inconsistency, sparse profiles, CQC ratings |
| R5 | 10 | CTA heading exclusion, CMS corruption, non-Nuffield hospitals, mobile numbers |
| R6 | 10 | Miss/Ms titles, cosmetic heading variant, substantive declarations, paediatric age ranges |

Architecture document covers: tech stack, data model, scoring formula, tier thresholds, naming conventions, error handling, retry strategy, and complete project structure.

### 2. Build (Complete)

All scraper pipeline stages implemented:
- **crawl.ts** — Sitemap XML reader + Playwright page fetcher
- **parse.ts** — Heading-based HTML extractor (40+ fields)
- **headings.ts** — Heading variant dictionary
- **booking.ts** — APIM API client (clinicdays, slots, pricing)
- **assess.ts** — Claude Haiku quality scorer
- **score.ts** — Deterministic scoring (completeness, tier, flags)
- **run.ts** — Pipeline orchestrator with resume/retry

Dashboard implemented:
- Overview page with quality tier chart
- Consultant list with filters and CSV export
- Consultant detail view
- Low-confidence review queue

Test suite: 161 tests (Vitest)

### 3. QA Testing (In Progress)

**Pre-testing — Single profile live scrape** (`professor-stephen-mcdonnell`):
- 7 bugs found and fixed (BUG-001 through BUG-007)
- Profile quality jumped Silver/65 → Gold/80 after fixes

**Phase 1 — Ground Truth (30-profile cohort):**
- 30/30 profiles scraped successfully (zero crashes)
- 5 new bugs found (BUG-008 through BUG-012):
  - BUG-008 (Moderate): Double spaces in consultant names — 5/30 affected
  - BUG-009 (Critical): Age restriction parsing garbled — 9/11 non-null values wrong
  - BUG-010 (Critical): hospital_is_nuffield always false — 30/30 wrong
  - BUG-011 (Critical): booking_state overwritten by API failure — 22/30 affected
  - BUG-012 (Moderate): CQC rating never captured — 30/30 null
- Fields verified correct: title prefix, specialty, hospital name, GMC, bio depth, photo, insurers, phone, declaration
- Full results: `_bmad-output/implementation-artifacts/test-results/phase-1-ground-truth.md`

**BUG-008 through BUG-012 fixed (2026-02-28):**
- BUG-008: Whitespace normalisation in `extractNameAndTitle()` — `.replace(/\s+/g, " ")`
- BUG-009: Age restriction scoped to short DOM elements with age keywords, min>max rejection, preamble required
- BUG-010: `hospital_is_nuffield` defaults true; only false for explicit non-Nuffield indicators
- BUG-011: Booking API catch block uses `onlineBookable` for fallback state (`bookable_no_slots` vs `not_bookable`)
- BUG-012: CQC regex broadened to match "CQC Overall rating Good" (no colon) + specific rating values

**30-profile cohort re-run (post BUG-008–012 fixes):**
- 30/30 profiles scraped successfully
- All 5 bug fields verified correct across the cohort

**10-profile random spot-check (2026-02-28):**
- 10 random profiles scraped from full 3,813-profile sitemap
- All 10 scraped successfully, spot-checked against live pages via Playwright
- 2 new bugs found (BUG-013, BUG-014) — both phone extraction issues
- All other fields (name, GMC, specialty, hospital, CQC, booking, age, insurers, declaration) verified correct

**BUG-013 and BUG-014 fixed (2026-02-28):**
- BUG-013: Phone extraction now prefers `itemprop="telephone"` (sidebar CTA) over tel: links (may contain central booking number)
- BUG-014: PHONE_REGEX widened from `\d{2,3}` to `\d{1,3}` to handle 3-digit area codes (London 020)

**Next:** Phase 2 (200-profile stress test)

### 4. Deployment (Not Started)

Manual CLI invocation on local machine. No scheduled automation yet (deferred to post-MVP).

---

## Open Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| ~~5 open bugs (3 Critical) from Phase 1~~ | ~~High~~ | All 14 bugs fixed — 161 tests passing |
| ~~Age restriction regex matches body text noise~~ | ~~High~~ | BUG-009 fixed — scoped search + required preamble + sanity checks |
| ~~hospital_is_nuffield logic inverted~~ | ~~High~~ | BUG-010 fixed — defaults true, only false for explicit non-Nuffield indicators |
| AI assessment can return null/fail silently | Medium | Heuristic fallback added (BUG-006), needs broader validation |
| 3,800 profiles with extreme structural variability | Medium | Parser handles known variants; Phase 1 found 5 new issues from 30 profiles |
| Booking API key may have rate limits or expiry | Low | Monitor during 200-profile stress test |
| CMS text corruption frequency unknown | Low | Detection rule added; frequency will be measured in broader runs |

---

## Success Criteria (from Quick Spec §11)

| Metric | Target | Current Evidence |
|--------|--------|-----------------|
| Deterministic field accuracy | >= 99% | 40 profiles tested (30 cohort + 10 random). 14 bugs found and fixed. All fields verified correct post-fix. |
| AI quality field agreement | >= 90% | Not yet measured (no API key configured) |
| Report/live consistency | 100% | 10 profiles spot-checked against live pages via Playwright — all fields match |
| Active profile coverage | 100% | 40/40 scraped successfully (zero crashes) |
| Full-run completion | No manual intervention | 30-profile cohort + 10 random profiles completed without intervention |

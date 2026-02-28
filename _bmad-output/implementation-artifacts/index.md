# Implementation Artifacts Index

**Project:** Nuffield Health Consultant Profile Quality Scraper
**Phase:** QA Testing
**Last updated:** 2026-02-28

---

## QA & Testing

| Document | Description | Status |
|----------|-------------|--------|
| [qa-test-plan.md](qa-test-plan.md) | Structured 5-phase QA test plan for data quality validation | Active |
| [test-results/phase-1-ground-truth.md](test-results/phase-1-ground-truth.md) | Phase 1 Ground Truth — 30 profiles, 5 bugs found | Complete |

## Bug Reports

| Bug | Severity | Status | Summary |
|-----|----------|--------|---------|
| [BUG-001](bug-reports/BUG-001.md) | Critical | Fixed | Cookie banner H1 captured as consultant name |
| [BUG-002](bug-reports/BUG-002.md) | Moderate | Fixed | Specialty array includes label prefix and trailing commas |
| [BUG-003](bug-reports/BUG-003.md) | Moderate | Fixed | Hospital name grabs CTA form content |
| [BUG-004](bug-reports/BUG-004.md) | Moderate | Fixed | practising_since null despite year present |
| [BUG-005](bug-reports/BUG-005.md) | Minor | Fixed | Declaration falsely flagged as substantive |
| [BUG-006](bug-reports/BUG-006.md) | Moderate | Fixed | AI failure masks bio_depth with "missing" |
| [BUG-007](bug-reports/BUG-007.md) | Minor | Fixed | external_website captures nuffieldhealthcareers.com |
| [BUG-008](bug-reports/BUG-008.md) | Moderate | Open | Double spaces in consultant names |
| [BUG-009](bug-reports/BUG-009.md) | Critical | Open | patient_age_restriction parsing broken — garbled from body text |
| [BUG-010](bug-reports/BUG-010.md) | Critical | Open | hospital_is_nuffield always false |
| [BUG-011](bug-reports/BUG-011.md) | Critical | Open | booking_state overwritten by API failure |
| [BUG-012](bug-reports/BUG-012.md) | Moderate | Open | CQC rating not captured — regex doesn't match DOM |

**Bug totals:** 12 found, 7 fixed, 5 open

## Code Metrics

| Metric | Value |
|--------|-------|
| Unit tests | 140 (Vitest) |
| Test files | parse.test.ts, score.test.ts, booking.test.ts, assess.test.ts |
| Source files | 13 (scraper: 7, db: 3, lib: 5) |

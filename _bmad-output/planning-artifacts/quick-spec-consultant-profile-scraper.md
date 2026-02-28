# Quick Tech Spec: Nuffield Health Consultant Profile Quality Scraper
**Version:** 1.7
**Date:** 2026-02-28
**Owner:** ROG (CEO initiative)
**Status:** QA Phase 1 complete — validated against 58 live profiles (pre-build) + 40 live scrapes (QA Phase 1: 30-profile cohort + 10 random spot-checks). 14 bugs found and fixed (BUG-001 through BUG-014). 161 unit tests passing. Entering QA Phase 2 (200-profile stress test).

> **v1.7 changes:** Formalized three booking fields already implemented but not previously in spec (`available_days_next_28_days`, `avg_slots_per_day`, `days_to_first_available`). Extended `clinicdays` API span from 28 to 90 days for `next_available_date` discovery — 28-day metrics remain the primary reporting view, extended availability is supplementary context. `days_to_first_available` computed field added for stakeholder reporting. QA Phase 1 completed: 40 profiles scraped successfully, 14 bugs identified and fixed across parsing, booking aggregation, scoring, and flag generation.
>
> **v1.6 changes:** Round 6 validation (10 new random profiles). New findings: "Miss" and "Ms" title prefixes confirmed — name parser must handle Mr/Mrs/Ms/Miss/Dr/Professor; cosmetic-specific treatment H3 variant with hospital name embedded in heading; Declaration section can contain substantive financial disclosures (e.g. equipment ownership through partnerships), not just boilerplate; "Nuffield Health at [NHS hospital]" naming pattern exists (Nuffield facility inside NHS hospital); patient age restrictions can be ranges (e.g. "0-18" for paediatric-only) and can contradict special interests; "Overview" can appear as a nav tab/button rather than an H2 heading — parser must distinguish; "View more" expandable content can truncate locations; 0300 non-geographic phone numbers exist.
>
> **v1.5 changes:** Round 5 validation (10 new random profiles). New findings: "Book online Ask a question" appears as a combined CTA H2 (must be excluded from content parsing); CMS text corruption exists with formatting artifacts breaking words; non-Nuffield hospitals can be the primary practice location for a listed consultant; Wales/Scotland hospitals have no CQC rating (different regulators — HIW/HIS); consultant names can include middle initials; mobile phone numbers appear alongside switchboard numbers; "Practising since" H2 can appear without year in heading text (year as separate inline element); booking caveat notes exist ("Online booking is for initial appointments only"); secretary email is a distinct contact method; duplicate CTA buttons can appear.
>
> **v1.4 changes:** Round 4 validation (10 new random profiles). New findings: "Professional Roles" is a new H2 heading variant; "Practising since: {year}" appears as H2 with value embedded in heading text; H2/H3 heading level inconsistency is systemic (same section type appears as H2 on one profile and H3 on another — affects Special interests, Languages spoken, Research, Memberships, Other posts held); specialty sub-items can appear as H3 under Specialties H2; patient age restriction notes exist; external website links exist on some profiles; CQC ratings appear in hospital location data; extremely sparse profiles exist (as few as 5 H2 headings, no treatments/declaration/insurers/consultation-times).
>
> **v1.3 changes:** Added independent live validation round (10 random profiles sampled from sitemap + 120 profile pattern scan + live booking API verification). New findings: `sitemap_consultants.xml` provides full slug list (3,814 URLs) and should be the primary crawl source; booking APIs require APIM subscription key header; `/slots` endpoint requires `uid` and `sessionDays`; registration IDs in the "GMC number" field can be non-numeric; treatment heading variants include "performs the following treatments" and typo variants.
>
> **v1.2 changes:** Updated after Round 2 validation of 10 additional profiles across 5 hospitals. Key findings: interest heading meaning is unstable, declaration section exists, consultation-time format is highly variable, non-bookable pages have different structure, booking widget is iframe-based, content truncation/entity corruption exist.
>
> **v1.1 changes:** Updated after Round 1 validation of 8 profiles. Multiple assumptions corrected from live observations.

---

## 1. What We Are Building

A system that:
1. Scrapes all consultant profiles from `nuffieldhealth.com/consultants/{slug}`
2. Pulls booking availability/pricing data from Nuffield booking APIs
3. Runs a lightweight AI quality assessment on free-text profile content
4. Outputs a structured dataset for management reporting and dashboarding

Primary objective: produce a management report where every reported point can be verified against the live profile and booking experience.

---

## 2. Data Sources

| Source | What It Provides | Access Method |
|--------|------------------|---------------|
| `https://www.nuffieldhealth.com/consultants/{slug}` | Profile content (name, photo, specialties, bio, treatments, insurers, qualifications, sections) | HTML scraping (Playwright recommended) |
| `https://api.nuffieldhealth.com/booking/consultant/1.0/clinicdays/gmc/{gmc}` | Clinic day availability by date/location | API call with `Ocp-Apim-Subscription-Key` |
| `https://api.nuffieldhealth.com/booking/consultant/1.0/slots` | Slot-level appointment availability | API call with `Ocp-Apim-Subscription-Key` + `uid`, `sessionDays` |
| `https://api.nuffieldhealth.com/booking/open/1.0/consultants/{gmc}/pricing/` | Consultant pricing per hospital code | API call with `Ocp-Apim-Subscription-Key` |
| Claude Haiku API | Language/depth/specificity quality scoring | 1 structured call per profile |
| `https://www.nuffieldhealth.com/sitemap_consultants.xml` | Canonical consultant slug list | Primary crawl source |

---

## 3. Core Data Schema

### 3.1 Identity and Crawl Fields
- `consultant_name` (string): first page `<h1>` text
- `consultant_title_prefix` (string): Mr, Mrs, Ms, Miss, Dr, Professor — extracted from H1
- `profile_url` (string)
- `profile_slug` (string)
- `http_status` (integer)
- `profile_status` (`active` | `deleted` | `error`)
- `registration_number` (string, from labelled "GMC number") — **canonical field name**
  - Extraction regex: `GMC number:\s*([A-Za-z0-9-]+)`
  - Important: values may be non-numeric (for example `PYL17432`, `HCPC-OR05785`)
- `gmc_code_for_booking` (string|null): booking API path parameter — derived from `registration_number` when it is a plain numeric string (passes `/^\d+$/`); `null` for non-numeric IDs (e.g. `HCPC-OR05785`) which cannot be used in booking API URL paths. Never use bare `gmc` as a field name in code or schema — always use one of these two canonical names.
- `hospital_name_primary` (string)
- `hospital_code_primary` (string)

### 3.2 Profile Quality Fields
- `has_photo` (boolean)
  - Detect `<aside class="consultant__image">` + valid `<img src>`
  - Missing aside is a valid no-photo state
- `specialty_primary` (array)
- `specialty_sub` (array, structured + AI fallback)
- `plain_english_score` (1-5, AI)
- `bio_depth` (`substantive` | `adequate` | `thin` | `missing`, AI)
- `treatments` (array)
  - Primary from H2 treatment section
  - Secondary from H3/H4 treatment section variants when present
- `treatments_excluded` (array)
- `treatment_specificity_score` (AI enum)
- `insurers` (array)
- `insurer_count` (integer)
- `qualifications_credentials` (string)
- `practising_since` (year|null)
- `memberships` (array)
- `clinical_interests` (array)
- `personal_interests` (string|null)
- `languages` (array)
- `consultation_times_raw` (array of strings)
- `declaration` (array of paragraphs|null)
- `in_the_news` (array of `{title,url}`|null)
- `professional_roles` (string|null)
- `patient_age_restriction` (string|null, full restriction text e.g. "only sees adults", "sees patients from the ages of 0 to 18")
- `patient_age_restriction_min` (integer|null, minimum patient age if stated)
- `patient_age_restriction_max` (integer|null, maximum patient age if stated)
- `external_website` (string|null, consultant's personal/practice website URL)
- `cqc_rating` (string|null, hospital CQC rating if displayed — null for Wales/Scotland hospitals under HIW/HIS jurisdiction)
- `booking_caveat` (string|null, e.g. "Online booking is for initial appointments only")
- `contact_phone` (string|null, direct phone number if displayed)
- `contact_mobile` (string|null, personal mobile number if displayed)
- `contact_email` (string|null, secretary email if displayed)
- `hospital_is_nuffield` (boolean, false when consultant's primary location is an external/NHS hospital)
- `hospital_nuffield_at_nhs` (boolean, true when hospital uses "Nuffield Health at [NHS hospital]" naming pattern)
- `declaration_substantive` (boolean, true when declaration contains actual financial interests/ownership, not just "no interests" boilerplate)

### 3.3 Booking Fields

**Primary (28-day window — leads in all reporting):**
- `booking_state` (`not_bookable` | `bookable_no_slots` | `bookable_with_slots`)
  - Primary signal: booking iframe presence/absence
  - Secondary signal: API responses
  - Scoped to the 28-day window: `bookable_with_slots` requires slots within 28 days
- `online_bookable` (boolean)
- `available_slots_next_28_days` (integer): total appointment slots within next 28 days (sum across all hospitals)
- `available_days_next_28_days` (integer): count of unique dates with at least one slot within next 28 days
- `avg_slots_per_day` (real|null): `available_slots_next_28_days / available_days_next_28_days`, rounded to 1 decimal place; null if no available days
- `consultation_price` (decimal|null)

**Extended availability (supplementary context):**
- `next_available_date` (date|null): earliest available appointment date across all hospitals, searched up to 90 days ahead; null if no slots found within 90-day window
- `days_to_first_available` (integer|null): calendar days from scrape date to `next_available_date`; null if `next_available_date` is null

### 3.4 Aggregate Fields
- `profile_completeness_score` (0-100): weighted sum of field presence and quality checks — see scoring formula below
- `quality_tier` (`Gold` | `Silver` | `Bronze` | `Incomplete`): derived from score + mandatory field gates — see tier thresholds below
- `flags` (array of `{code, severity, message}` objects): generated by rules engine; `severity` is one of `fail` | `warn` | `info`

#### Scoring Formula

**Field weights (total = 100 points):**

| Field / Condition | Points | Notes |
|-------------------|--------|-------|
| `has_photo` = true | 10 | Binary |
| `bio_depth` = `substantive` | 15 | 10 pts for `adequate`; 0 pts for `thin` or `missing` |
| `treatments` non-empty | 10 | Waived (0 deduction) when specialty rules engine marks profile as non-procedural |
| `qualifications_credentials` non-null | 10 | |
| `specialty_primary` non-empty | 10 | |
| `insurers` non-empty | 8 | |
| `consultation_times_raw` non-empty | 7 | |
| `plain_english_score` (AI 1–5) | 10 | `>= 4` = 10 pts; `= 3` = 5 pts; `<= 2` = 0 pts |
| `booking_state` | 10 | `bookable_with_slots` = 10 pts; `bookable_no_slots` = 5 pts; `not_bookable` = 0 pts |
| `practising_since` non-null | 5 | |
| `memberships` non-empty | 5 | |
| **Total** | **100** | |

**Tier gates (score threshold + mandatory field requirements):**

| Tier | Min Score | Mandatory Fields |
|------|-----------|-----------------|
| `Gold` | ≥ 80 | `has_photo` = true AND `bio_depth` = `substantive` AND `specialty_primary` non-empty |
| `Silver` | ≥ 60 | `has_photo` = true AND `specialty_primary` non-empty |
| `Bronze` | ≥ 40 | `specialty_primary` non-empty |
| `Incomplete` | < 40 | — also applied when any Gold/Silver/Bronze mandatory field is missing |

A profile with any `fail`-severity flag cannot be assigned `Gold`. A profile with two or more `fail` flags is forced to `Incomplete` regardless of score.

**Flag severity rules:**
- `fail`: a mandatory completeness condition is not met (blocks tier upgrade)
- `warn`: a below-average field that reduces score but does not block tier
- `info`: an observation requiring no action (e.g. substantive financial declaration, external website present, non-Nuffield primary hospital)
- Flag codes are prefixed by category: `PROFILE_*` (e.g. `PROFILE_NO_PHOTO`), `BOOKING_*` (e.g. `BOOKING_NO_SLOTS`), `CONTENT_*` (e.g. `CONTENT_THIN_BIO`), `QA_*` (e.g. `QA_LOW_CONFIDENCE`)
- Low-confidence extractions (confidence = `low` on any field) always produce a `QA_LOW_CONFIDENCE` warn flag and route the profile to the manual review queue

---

## 4. Scraper Architecture

### 4.1 Two-layer Design
- Layer 1: deterministic extractor (Playwright + heading-based parser)
- Layer 2: AI assessor (Haiku) for language and inferred semantics

### 4.2 Non-standardization Strategy
Use heading and pattern classification, not fixed DOM positions:
- Stable H2 exact matches: `Qualifications`, `Specialties`, `Consultation times`, `About`, `Related experience`, `Declaration`
- **"Overview" disambiguation:** Can appear as an H2 heading OR as a nav tab/button UI element. Parser must check that the element is actually an `<h2>` tag, not a `<button>`, `<a>`, or `<span>`.
- Partial treatment heading matches:
  - `Treatments and tests offered`
  - `Treatments, tests and scans`
  - `specialises in the following treatments`
  - `specialises the following treatments` (typo variant)
  - `performs the following treatments`
  - `specialises in the following cosmetic treatments at {Hospital Name}` (cosmetic-specific variant with hospital name embedded)
- Heading-level-unstable sections (appear as H2 on some profiles, H3 on others — must match at both levels):
  - `Special interests`, `Other interests`, `Personal interests`
  - `Languages spoken`
  - `Research`, `Memberships`, `Other posts held`
  - `Professional Roles`
- Informational heading capture (H2 or H3): `In the news`
- Embedded-value headings: `Practising since: {year}` — extract year from heading text. Variant: `Practising since` as H2 with year as separate inline element (not in heading text)
- Specialty sub-items: may appear as H3 under `Specialties` H2 (e.g. `General Surgery`)
- Insurer heading: `Insurers {Name} works with` (H2)
- Location heading: `Locations {Name} works with` (H2) with hospital names as H3
- **CTA headings to exclude from content parsing:** `Book online Ask a question` (combined CTA H2 — ignore during section extraction)
- **CMS text corruption:** Some profiles contain formatting artifacts (e.g. asterisks breaking words from markdown/bold errors). Parser should strip or flag corrupted text patterns.
- **"View more" expandable content:** Some sections (especially Locations) hide content behind JS-driven expand buttons. Playwright must click "View more" or wait for full render before extracting.

### 4.3 Booking/API Handling
- Always send `Ocp-Apim-Subscription-Key`
- `clinicdays` call:
  - `GET /booking/consultant/1.0/clinicdays/gmc/{gmc}?span=90&fromDate={date}`
  - Uses `span=90` to discover availability beyond 28 days for `next_available_date`
  - 28-day metrics (`available_slots_next_28_days`, `available_days_next_28_days`, `avg_slots_per_day`, `booking_state`) are derived by filtering clinicdays results to the first 28 days only
  - `next_available_date` and `days_to_first_available` use the full 90-day response
- `slots` call:
  - `GET /booking/consultant/1.0/slots?uid={uuid}&fromDate={date}&gmcCode={gmc}&hospitalId={id}&sessionDays=0`
- Interpret 404 from booking API as a valid no-online-booking state when page is active

---

## 5. Haiku Prompt Contract

Single JSON output per profile:
- plain English score + reason
- bio depth + reason
- treatment specificity + reason
- qualifications completeness + reason
- inferred sub-specialties
- personal interests
- clinical interests
- professional interests
- languages
- overall quality notes

Use strict JSON schema validation on response before persistence.

---

## 6. Consultant Crawl Strategy

Primary strategy:
1. Read `https://www.nuffieldhealth.com/sitemap_consultants.xml`
2. Extract all consultant profile URLs
3. Deduplicate URL list
4. Scrape each profile URL

Fallback/monitor strategy:
- Use hospital consultant pages only for QA validation and sitemap lag monitoring
- Do not depend on JS-driven `/consultants` or hospital listings as canonical source

Crawl behavior:
- Respect polite rate limits
- Record 404 profiles as `deleted`, do not treat as run failure

---

## 7. Output Format

- Primary: JSON (one record per consultant)
- Secondary: CSV export for BI and audit
- Suggested cadence: monthly initial refresh

---

## 8. Validation Plan

### Completed validation
- Round 1: 8 profiles
- Round 2: 10 profiles
- Round 3: 10 random profiles + 120-profile structural pattern scan + booking API verification
- Round 4: 10 random profiles (from sitemap sample, no overlap with R1-R3)
- Round 5: 10 random profiles (from sitemap sample, no overlap with R1-R4)
- Round 6: 10 random profiles (from sitemap sample, no overlap with R1-R5) — first Miss/Ms prefixes, cosmetic variant, paediatric-only

### Build validation phases
1. ~~Single-profile perfection~~ — Complete
2. ~~30-profile ground truth cohort + 10 random spot-checks~~ — Complete (14 bugs found/fixed, 161 unit tests)
3. 200-profile stress test — **In progress**
4. Full run

Targets:
- Deterministic fields >= 99% accuracy
- AI-assessed fields >= 90% reviewer agreement

---

## 9. Dashboard Requirements

- Quality tier distribution
- Filter by hospital, specialty, flag, bookability
- Drilldown by consultant with field-by-field evidence
- Direct live profile links
- Availability/next date/slots views
- CSV/PDF export

---

## 10. Decision Log

All former open questions have been resolved in `architecture.md`. Cross-references below.

| # | Question | Decision | Architecture Ref |
|---|----------|----------|-----------------|
| 1 | Runtime/infrastructure | CLI on local Node.js; manual invocation; `npx tsx src/scraper/run.ts` | architecture.md §Infrastructure & Deployment |
| 2 | Storage model | SQLite + Drizzle ORM; immutable run snapshots keyed by `run_id`; raw HTML to disk | architecture.md §Data Architecture |
| 3 | Dashboard stack | Next.js 16 App Router + shadcn/ui + Recharts; Server Components query SQLite directly | architecture.md §Frontend Architecture |
| 4 | Scheduling and re-crawl trigger | Manual monthly; deferred to post-MVP (cron/GitHub Actions) | architecture.md §Deferred Decisions |
| 5 | Resume/retry strategy | Stage-level checkpoints per (run_id, slug); bounded exponential backoff with jitter | architecture.md §Retry Strategy |
| 6 | API key management | `.env` file (gitignored); `APIM_SUBSCRIPTION_KEY` + `ANTHROPIC_API_KEY` | architecture.md §Environment Configuration |
| 7 | Multi-hospital availability aggregation | Sum across all hospital slots for `available_slots_next_28_days`; earliest date across hospitals for `next_available_date` | architecture.md §Booking Data |
| 8 | Treatment/consultation-time normalisation | Phase 2 deferred; raw arrays captured verbatim now | architecture.md §Deferred Decisions |
| 9 | Enquiry-form taxonomy for non-bookable profiles | Out of scope for MVP; `booking_state: not_bookable` is the signal | architecture.md §Deferred Decisions |
| 10 | Extended availability window | `clinicdays` span extended from 28→90 days; 28-day metrics remain primary for reporting; `next_available_date` and `days_to_first_available` use full 90-day window as supplementary context | quick-spec §3.3, §4.3 |

---

## 11. Success Criteria

| Metric | Target |
|--------|--------|
| Deterministic field accuracy | >= 99% |
| AI quality field agreement | >= 90% |
| Report/live consistency | 100% |
| Active profile coverage | 100% |
| Full-run completion | No manual intervention |

---

## 11a. Data Governance — Contact Fields

The fields `contact_phone`, `contact_mobile`, and `contact_email` contain personal data. Although source data is publicly displayed on the Nuffield website at point of collection, the following controls apply to its storage and use in this system:

### Retention
- Contact field data is retained for the lifetime of the `scrape_run` record it belongs to.
- Run records older than the configured retention window (`DATA_RETENTION_DAYS`, default 90 days) may be pruned in a manual cleanup operation. Pruning removes the `consultants` rows for that `run_id`, the associated raw HTML from `data/html-cache/{run_id}/`, and the `scrape_runs` metadata row.
- No automated deletion is implemented at MVP; pruning is a documented manual DBA operation.

### Access
- The dashboard is restricted to internal/intranet access only (localhost or private network). No authentication is required at MVP; do not expose publicly.
- Contact fields are visible on the `/consultants/[slug]` detail view for authorised internal users only.
- Contact fields are **excluded from CSV export by default**. Export is opt-in via `EXPORT_INCLUDE_CONTACT_DATA=true` (environment variable).

### Export masking
- The `/api/export` CSV endpoint omits `contact_phone`, `contact_mobile`, and `contact_email` unless `EXPORT_INCLUDE_CONTACT_DATA=true` is explicitly set in the environment.
- When masking is active, the columns are omitted entirely (not blanked) from the export.

### Audit logging
- All accesses to the `/consultants/[slug]` detail page (which displays contact fields) are logged to `data/audit.log` with: ISO timestamp, slug, and requesting IP address.
- CSV exports that include contact data are also logged to `data/audit.log`.
- Audit log is append-only; never delete or truncate it.

### Data sensitivity classification
- Non-contact profile data (name, specialty, qualifications, booking): **Low** — publicly available, no personal data concerns
- Contact fields (`contact_phone`, `contact_mobile`, `contact_email`): **Medium** — personal data; apply controls above

---

## 12. Round 3 Independent Validation Addendum

### 12.1 Ten random live profile checks
Random sample URLs (from sitemap):
1. `https://www.nuffieldhealth.com/consultants/mr-nigel-dsouza`
2. `https://www.nuffieldhealth.com/consultants/mr-najaf-siddiqi`
3. `https://www.nuffieldhealth.com/consultants/mr-aroon-baskaradas`
4. `https://www.nuffieldhealth.com/consultants/dr-clifford-weir`
5. `https://www.nuffieldhealth.com/consultants/dr-claudia-degiovanni`
6. `https://www.nuffieldhealth.com/consultants/mr-owen-wall`
7. `https://www.nuffieldhealth.com/consultants/dr-gemma-price`
8. `https://www.nuffieldhealth.com/consultants/dr-andrew-johnston`
9. `https://www.nuffieldhealth.com/consultants/professor-rajesh-nanda`
10. `https://www.nuffieldhealth.com/consultants/mr-gans-thiagamoorthy`

Observed in this sample:
- Mixed bookable and non-bookable profiles
- Declaration present on some, absent on others
- Insurers present on some, absent on others
- Consultation times present on some, absent on others
- Languages heading appears inconsistently
- Treatment H3 variant confirmed in addition to H2 treatment block

### 12.2 Larger pattern scan (120 random profiles)
- 120/120 returned HTTP 200 in sample window
- Declaration present: 93
- Consultation times present: 93
- Treatments section missing entirely: 20
- Insurers section missing entirely: 34
- Booking iframe present: 90
- Languages H3 present: 27
- In-the-news H3 present: 1

### 12.3 High-impact gaps closed
- Slug discovery should use sitemap as primary source
- Booking API requires APIM header; unauthenticated calls return 401
- Slot endpoint requires additional query params (`uid`, `sessionDays`)
- Registration field extraction must support alphanumeric IDs
- Treatment heading matching must include `performs` and typo variants

---

## 13. Implementation Recommendation for Non-standardized Data

Use a confidence-scored hybrid extractor:
1. Deterministic heading parser with synonym/variant dictionary and typo tolerance
2. Section-level confidence score (`high`, `medium`, `low`) per extracted field
3. Fallback inferencing only when deterministic extraction is missing/ambiguous
4. Raw-text retention for every extracted section for auditability
5. Explicit anomaly flags (missing section, empty section, truncated text, corrupted entities)
6. Rules engine for specialty-aware scoring exceptions (for example treatments not expected for some consultant types)

This approach is robust enough for production if implemented with strict schema validation, retry/resume, and manual review queues for low-confidence records.

---

## 14. Round 4 Validation Addendum

### 14.1 Ten random live profile checks
Random sample URLs (from sitemap, no overlap with R1-R3):
1. `https://www.nuffieldhealth.com/consultants/mr-dynesh-rittoo`
2. `https://www.nuffieldhealth.com/consultants/mr-christopher-foxton`
3. `https://www.nuffieldhealth.com/consultants/professor-mohamed-imam`
4. `https://www.nuffieldhealth.com/consultants/dr-rahul-potluri`
5. `https://www.nuffieldhealth.com/consultants/professor-marios-papadopoulos`
6. `https://www.nuffieldhealth.com/consultants/mr-suresh-sagili`
7. `https://www.nuffieldhealth.com/consultants/dr-emma-mcgrath`
8. `https://www.nuffieldhealth.com/consultants/professor-miles-parkes`
9. `https://www.nuffieldhealth.com/consultants/mr-christopher-lodge`
10. `https://www.nuffieldhealth.com/consultants/mr-dimitri-pournaras`

### 14.2 Profile structure matrix

| Profile | GMC | H2 Count | Declaration | Consult Times | Insurers | Treatments | Booking | Photo |
|---|---|---|---|---|---|---|---|---|
| Mr Dynesh Rittoo | 3556456 | 9 | Yes | Yes | No | Yes | Yes | Yes |
| Mr Christopher Foxton | 6128231 | 15 | Yes | Yes | Yes | Yes | Yes | Yes |
| Prof Mohamed Imam | 7043919 | 13 | Yes | Yes | Yes | Yes | Yes | Yes |
| Dr Rahul Potluri | 6166670 | 7 | Yes | No | No | Yes | Yes | Yes |
| Prof Marios Papadopoulos | 4029038 | 10 | Yes | Yes | Yes | Yes | Yes | Yes |
| Mr Suresh Sagili | 6059082 | 15 | Yes | Yes | Yes | Yes | Yes | Yes |
| Dr Emma McGrath | 6117467 | 5 | No | No | No | No | Yes | Yes |
| Prof Miles Parkes | 3485460 | 10 | Yes | Yes | Yes | Yes | Yes | Yes |
| Mr Christopher Lodge | 7130930 | 12 | No | Yes | Yes | Yes | Yes | Yes |
| Mr Dimitri Pournaras | 6109278 | 9 | Yes | No | Yes | Yes | Yes | Yes |

### 14.3 New findings from Round 4

1. **"Professional Roles" is a new H2 heading** — found on Prof Imam, not previously documented. Added to heading variant dictionary.

2. **"Practising since: {year}" appears as a standalone H2** — the year value is embedded in the heading text itself (e.g. `Practising since: 2004`). Extraction must parse year from the heading, not from body text.

3. **H2/H3 heading level inconsistency is systemic** — the same section type appears as H2 on some profiles and H3 on others. This is not occasional but routine. Affected sections:
   - `Special interests`: H2 on Foxton, Sagili; H3 on Rittoo, Papadopoulos
   - `Languages spoken`: H2 on Imam, Foxton; H3 on Rittoo, Papadopoulos
   - `Research`: H2 on Lodge; H3 on Parkes, Rittoo, Papadopoulos
   - `Memberships`: H2 on Foxton, Sagili, Lodge; H3 on Rittoo, Papadopoulos, Pournaras
   - `Other posts held`: H2 on Foxton, Sagili, Lodge; H3 on Rittoo, Papadopoulos, Pournaras
   - **Implication:** The parser must match section headings by text, not by heading level. All known section names should be matched at H2, H3, or H4.

4. **Specialty sub-items as H3** — Pournaras has `General Surgery` as an H3 under the `Specialties` H2. Parser should capture specialty sub-headings as additional specialty data.

5. **Patient age restriction notes** — Papadopoulos has "only sees adults" inline note. Added `patient_age_restriction` to schema.

6. **External website links** — Potluri links to `exeterheart.com`, Papadopoulos to a personal neurosurgery website. Added `external_website` to schema.

7. **CQC rating in hospital data** — Cambridge hospital shows "CQC rating: Outstanding". Added `cqc_rating` to schema.

8. **Extremely sparse profiles** — Dr Emma McGrath has only 5 H2 headings (Qualifications, Specialties, Overview, About, Locations). No treatments, no declaration, no consultation times, no insurers. Scraper must treat missing sections as valid data states, not extraction failures.

9. **All 10 GMC numbers were numeric** — consistent with the common case. The alphanumeric edge case (documented in R3) remains valid but is the exception.

10. **H2 count ranges from 5 to 15** — confirming extreme structural variability across profiles. The heading-level-agnostic text-matching parser strategy is essential.

### 14.4 Impact on architecture
- Section 4.2 updated: heading classification now matches by text at any heading level (H2/H3/H4)
- Section 3.2 updated: four new schema fields added (`professional_roles`, `patient_age_restriction`, `external_website`, `cqc_rating`)
- "Practising since" extraction rule updated: parse year from heading text, not body
- Sparse-profile handling confirmed: all missing sections should produce null/empty, not errors

---

## 15. Round 5 Validation Addendum

### 15.1 Ten random live profile checks
Random sample URLs (from sitemap, no overlap with R1-R4):
1. `https://www.nuffieldhealth.com/consultants/dr-timothy-ham`
2. `https://www.nuffieldhealth.com/consultants/mr-jonathan-clamp`
3. `https://www.nuffieldhealth.com/consultants/dr-oliver-foster`
4. `https://www.nuffieldhealth.com/consultants/mr-patrick-lee`
5. `https://www.nuffieldhealth.com/consultants/mr-chris-little`
6. `https://www.nuffieldhealth.com/consultants/mr-sanjay-chawathe`
7. `https://www.nuffieldhealth.com/consultants/mr-dan-titcomb`
8. `https://www.nuffieldhealth.com/consultants/dr-alexandra-stewart`
9. `https://www.nuffieldhealth.com/consultants/mr-james-heal`
10. `https://www.nuffieldhealth.com/consultants/dr-astor-rodrigues`

### 15.2 Profile structure matrix

| Profile | GMC | H2 Count | Declaration | Consult Times | Insurers | Treatments | Booking | Photo |
|---|---|---|---|---|---|---|---|---|
| Dr Timothy Ham | 6132702 | 10 | No | Yes | Yes | No | Yes | Yes |
| Mr Jonathan A. Clamp | 6026831 | 9 | Yes | Yes | No | Yes | Yes | Maybe |
| Dr Oliver Foster | 2829243 | 8 | Yes | Yes | Yes | No | Yes | Yes |
| Mr Patrick Lee | 3441994 | 9 | Yes | Yes | Yes | No | Yes | Yes |
| Mr Chris Little | 4032461 | 11 | Yes | Yes | Yes | Yes | Yes | Yes |
| Mr Sanjay Chawathe | 4566818 | 11 | Yes | Yes | Yes | Yes | Yes | Yes |
| Mr Dan Titcomb | 4405829 | 10 | Yes | Yes | Yes | Yes | Yes | Yes |
| Dr Alexandra Stewart | 4424011 | 9 | Yes | No | Yes | Yes | Yes | Yes |
| Mr James Heal | 4202923 | 10 | No | Yes | Yes | Yes | Yes | Yes |
| Dr Astor Rodrigues | 5193608 | 8 | Yes | No | Yes | Yes | Yes | Yes |

### 15.3 New findings from Round 5

1. **"Book online Ask a question" is a combined CTA H2** — found on Patrick Lee and James Heal. This heading combines two call-to-action buttons and must be excluded from content section parsing. Added to CTA exclusion list.

2. **CMS text corruption with formatting artifacts** — Dr Oliver Foster's profile contains "s\*\*\*\*ees adults" where asterisks from markdown/bold formatting break the word "sees". Parser must detect and flag or strip formatting-artifact corruption in extracted text.

3. **Non-Nuffield hospital as primary practice location** — Dr Alexandra Stewart is listed on the Nuffield site but her primary location is "St Luke's Cancer Centre, Royal Surrey County Hospital" (an external NHS facility). Added `hospital_is_nuffield` boolean to schema.

4. **Wales hospitals have no CQC rating** — Mr Sanjay Chawathe practices at Cardiff and Vale Hospital. CQC (Care Quality Commission) only regulates England; Wales uses HIW (Healthcare Inspectorate Wales), Scotland uses HIS. `cqc_rating` will be null by jurisdiction, not missing data. Parser should not flag this as a data gap.

5. **Middle initial in consultant name** — Mr Jonathan A. Clamp has "A." in the H1 name. Name parsing must handle middle initials, not just title + first + last.

6. **Mobile phone numbers on profiles** — Dr Astor Rodrigues displays a personal mobile number (07949483300) alongside or instead of a hospital switchboard. Added `contact_mobile` to schema, distinct from `contact_phone`.

7. **"Practising since" H2 without year in heading text** — On Chawathe's profile, the H2 text is "Practising since" with the year rendered as a separate inline element, not embedded in the heading. Parser must check both heading text and following inline text for the year value.

8. **Booking caveat notes** — Mr Chris Little's profile states "Online booking is for initial appointments only." Added `booking_caveat` to schema.

9. **Secretary email as contact method** — Mr Chris Little directs patients to email a medical secretary for appointments not available online. Added `contact_email` to schema.

10. **Duplicate CTA buttons** — Dr Astor Rodrigues has "Enquire now" appearing twice on the page. Parser should deduplicate CTA detection.

11. **Placeholder/ambiguous photos** — Mr Jonathan A. Clamp's photo source URL matches the thumbnail endpoint pattern but may be a placeholder. Photo detection should validate the actual image URL, not just the presence of an `<img>` tag.

12. **4 out of 10 profiles had no treatments section** — Dr Ham, Dr Foster, Mr Patrick Lee, and Dr Rodrigues (corrected: Rodrigues does have treatments). Three profiles use "Special interests" to describe clinical scope instead of a treatments heading. This reinforces that treatment data may need to be inferred from interests when the section is absent.

### 15.4 Impact on architecture
- Section 4.2 updated: CTA headings ("Book online Ask a question") added to exclusion list; CMS corruption detection rule added
- Section 3.2 updated: five new schema fields (`booking_caveat`, `contact_phone`, `contact_mobile`, `contact_email`, `hospital_is_nuffield`)
- `cqc_rating` field documentation updated: null is valid for non-England hospitals (Wales HIW, Scotland HIS)
- "Practising since" extraction rule updated: must handle both embedded-in-heading and separate-inline-element patterns
- Name parsing: must support middle initials (e.g. "Mr Jonathan A. Clamp")
- Photo validation: should verify actual image URL, not just `<img>` tag presence
- Treatment inference: when treatments section is absent, consider extracting clinical scope from "Special interests" as fallback data source

---

## 16. Round 6 Validation Addendum

### 16.1 Ten random live profile checks
Random sample URLs (from sitemap, no overlap with R1-R5):
1. `https://www.nuffieldhealth.com/consultants/dr-rebecca-harris`
2. `https://www.nuffieldhealth.com/consultants/mr-william-gietzmann`
3. `https://www.nuffieldhealth.com/consultants/professor-christof-kastner`
4. `https://www.nuffieldhealth.com/consultants/dr-ravi-gill`
5. `https://www.nuffieldhealth.com/consultants/mr-jaison-patel`
6. `https://www.nuffieldhealth.com/consultants/mr-martin-goddard`
7. `https://www.nuffieldhealth.com/consultants/miss-caroline-cheadle`
8. `https://www.nuffieldhealth.com/consultants/ms-kallirroi-tzafetta`
9. `https://www.nuffieldhealth.com/consultants/dr-jo-bailey`
10. `https://www.nuffieldhealth.com/consultants/mr-ashok-rajimwale`

### 16.2 Profile structure matrix

| Profile | Title | GMC | H2 Count | Declaration | Consult Times | Insurers | Treatments | Booking | Photo |
|---|---|---|---|---|---|---|---|---|---|
| Dr Rebecca Harris | Dr | 3580671 | 8 | Yes | Yes | No | Yes (1) | Yes | Yes |
| Mr William Gietzmann | Mr | 7084352 | 12 | Yes | Yes | Yes (36) | Yes | Yes | Yes |
| Prof Christof Kastner | Prof | 4483971 | 10 | Yes | Yes | Yes (16) | Yes | Yes | Yes |
| Dr Ravi Gill | Dr | 7271792 | 7 | No | Yes | No | No | Yes | Yes |
| Mr Jaison Patel | Mr | 7271986 | 9 | Yes | No | Yes (24) | Yes | Yes | Yes |
| Mr Martin Goddard | Mr | 4534396 | 10 | Yes | Yes | Yes (30) | Yes | Yes | Yes |
| Miss Caroline Cheadle | Miss | 7039517 | 8 | Yes | No | No | Yes | Yes | Yes |
| Ms Kallirroi Tzafetta | Ms | 4236942 | 10 | Yes | Yes | No | Yes | Yes | Yes |
| Dr Jo Bailey | Dr | 4013523 | 9 | Yes | Yes | Yes (12) | Yes | Yes | Yes |
| Mr Ashok Rajimwale | Mr | 4358697 | 8 | Yes | Yes | Yes (35) | No | Yes | Yes |

### 16.3 New findings from Round 6

1. **"Miss" and "Ms" title prefixes confirmed** — Miss Caroline Cheadle and Ms Kallirroi Tzafetta are the first profiles with these prefixes. Name parser must handle the full set: Mr, Mrs, Ms, Miss, Dr, Professor. Added `consultant_title_prefix` to schema.

2. **Cosmetic-specific treatment H3 with hospital name embedded** — Ms Tzafetta has `"Ms Tzafetta specialises in the following cosmetic treatments at Nuffield Health Brentwood Hospital"` as an H3. This is a new treatment heading variant that includes the consultant's name, the word "cosmetic", and the specific hospital name. Added to treatment heading variant list.

3. **Substantive Declaration content** — Prof Kastner declares ownership of "a share in a 100 W Holmium Laser" through Cambridge Urology Partnership. Declarations are not always boilerplate "no interests" text — some contain real financial disclosures. Added `declaration_substantive` boolean to schema.

4. **"Nuffield Health at St Bartholomew's"** — A Nuffield facility operating inside a well-known NHS hospital. This is a hybrid naming pattern where `hospital_is_nuffield` is true but the hospital name includes an NHS brand. Added `hospital_nuffield_at_nhs` to schema.

5. **Patient age restriction as a range** — Mr Rajimwale "sees patients from the ages of 0 to 18" (paediatric-only). This is the opposite of "adults only". Added `patient_age_restriction_min` and `patient_age_restriction_max` to schema for structured extraction.

6. **Age restriction contradicts special interests** — Mr Goddard is flagged as "adults only" but lists "Paediatric knee problems (over 14 years old)" under Special interests. Parser should capture the full restriction text and flag contradictions for QA review.

7. **"Overview" as nav tab, not H2** — On Dr Bailey and Mr Rajimwale, "Overview" is a `<button>` or `<a>` navigation element, not an `<h2>` heading. Parser must verify the HTML tag type, not just the text content. Updated heading classification in Section 4.2.

8. **"View more" expandable content** — Locations section on some profiles hides additional hospitals behind a JS expand button. Playwright must click "View more" or wait for full DOM render before extracting location data.

9. **0300 non-geographic phone numbers** — Prof Kastner has 0300 131 1433 for the St Bart's location. Phone number parsing must accept 01xx, 02xx, 03xx, and 07xxx formats.

10. **Phone number format inconsistency on same page** — Dr Gill shows the same number as both "02073943300" (no spaces) and "020 7394 3300" (with spaces). Phone normalisation should strip spaces/formatting before comparison.

11. **36 insurers on a single profile** — Mr Gietzmann lists 36 insurance providers. Insurer array can be high-cardinality; no hardcoded max.

12. **ResearchGate as external link type** — Dr Gill links to a ResearchGate profile. External links are not limited to personal practice websites; they include academic profiles. `external_website` field should capture any external URL.

### 16.4 Impact on architecture
- Section 3.1 updated: `consultant_title_prefix` added (Mr/Mrs/Ms/Miss/Dr/Professor)
- Section 3.2 updated: `patient_age_restriction_min`, `patient_age_restriction_max`, `hospital_nuffield_at_nhs`, `declaration_substantive` added
- Section 4.2 updated: "Overview" disambiguation rule added; cosmetic treatment heading variant added; "View more" expand rule added
- Name parsing: must handle full title set including Miss and Ms
- Phone normalisation: strip spaces, accept 01/02/03/07 prefixes
- Declaration analysis: distinguish boilerplate "no interests" from substantive disclosures (AI assessor task)
- Age restriction QA: flag profiles where restriction text contradicts special interests
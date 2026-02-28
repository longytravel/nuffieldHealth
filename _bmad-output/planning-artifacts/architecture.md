---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - quick-spec-consultant-profile-scraper.md
workflowType: 'architecture'
project_name: 'nuffieldHealth'
user_name: 'ROG'
date: '2026-02-27'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
1. **Profile Discovery** — Crawl sitemap XML to discover ~3,814 consultant profile URLs
2. **Profile Extraction** — Parse non-standardised HTML to extract 40+ structured fields per profile using heading-based classification (not DOM position)
3. **Booking Data Retrieval** — Call 3 APIM-authenticated APIs (clinicdays, slots, pricing) per bookable consultant
4. **AI Quality Assessment** — Single Claude Haiku call per profile for language quality, bio depth, treatment specificity, and inferred fields
5. **Data Output** — JSON primary, CSV secondary export for BI consumption
6. **Management Dashboard** — Quality tier distribution, filtering, drilldown, live profile links, availability views, export

**Non-Functional Requirements:**
- Deterministic field accuracy >= 99%
- AI quality field agreement >= 90%
- Report/live consistency 100% (every data point verifiable against source)
- Full-run completion with no manual intervention
- Polite rate limiting for web scraping
- Resume/retry capability for partial failures
- Raw text retention for auditability

**Scale & Complexity:**
- Primary domain: Backend data pipeline + reporting frontend
- Complexity level: Medium
- Estimated architectural components: 6 (crawler, parser, API client, AI assessor, data store, dashboard)
- Data volume: ~3,800 profiles, monthly refresh
- Concurrency model: Sequential/batched processing (no real-time)

### Technical Constraints & Dependencies

- **Playwright required** — profiles contain JS-rendered content (booking iframes, "View more" expand buttons, nav tabs)
- **APIM subscription key** — booking APIs return 401 without `Ocp-Apim-Subscription-Key` header
- **Claude API key** — Haiku quality assessment requires Anthropic API access
- **Sitemap as canonical source** — `sitemap_consultants.xml` provides the authoritative URL list; JS-driven listings are unreliable
- **Non-standardised HTML** — heading levels (H2/H3/H4) are inconsistent across profiles for the same section type; parser must match by text content, not heading level
- **CMS text corruption** — formatting artifacts exist in some profiles; parser must detect and flag
- **Optional sections** — profiles range from 5 to 15 H2 headings; all missing sections are valid data states, not errors

### Cross-Cutting Concerns Identified

1. **Resilience & Recovery** — Must handle 404s, API timeouts, malformed HTML, and partial run failures without manual intervention
2. **Rate Limiting** — Polite crawling cadence for web scraping; API call throttling for APIM endpoints
3. **Credential Management** — Two API keys (APIM + Claude) need secure storage and rotation capability
4. **Data Quality Pipeline** — Per-field confidence scoring (high/medium/low), anomaly flagging, manual review queue for low-confidence records
5. **Auditability** — Raw HTML/text retention per profile so every reported metric traces back to source evidence
6. **Idempotency** — Re-runs should produce consistent results; data should be timestamped and versioned

## Starter Template Evaluation

### Primary Technology Domain

Backend data pipeline + reporting dashboard — a batch ETL system with a web-based consumption layer. Both workloads share a single TypeScript codebase.

### Technology Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | TypeScript | 5.x | Strong typing for 40+ field schema, unified across pipeline and dashboard |
| Runtime | Node.js | 20+ | Required by Next.js 16, Playwright's native environment |
| Scraping | Playwright | 1.58 | Required by spec — JS rendering, iframes, expand buttons |
| AI Assessment | @anthropic-ai/sdk | 0.78 | Claude Haiku quality scoring, structured JSON output |
| Database | SQLite + Drizzle ORM | latest | Zero-config, file-based, perfect for ~3,800 records with typed queries |
| SQLite Driver | better-sqlite3 | latest | Fast synchronous SQLite driver for Node.js |
| Dashboard | Next.js | 16.1 | App Router, Tailwind, TypeScript — proven stack for internal tools |
| UI Components | shadcn/ui | latest | Copy-paste components, no dependency lock-in |
| Charts | Recharts | latest | Composable React charting for quality tier visualisations |
| Package Manager | pnpm | latest | Fast, disk-efficient |

### Starter Options Considered

| Option | Verdict |
|--------|---------|
| **Next.js (create-next-app)** | Selected — provides dashboard framework + project scaffolding, scraper code added alongside |
| Python + Playwright + Flask/Dash | Rejected — two languages needed (Python pipeline + JS dashboard), or compromised dashboard |
| Standalone Node.js + separate React app | Rejected — unnecessary separation for a single-user MVP, doubles config overhead |
| Monorepo (Turborepo/pnpm workspaces) | Rejected — adds tooling complexity without proportional benefit at MVP scale |

### Selected Starter: Next.js via create-next-app

**Rationale:** Next.js provides the dashboard framework, TypeScript scaffolding, Tailwind setup, and project structure. The scraper pipeline is added as sibling modules in `/src/scraper/`, sharing the same TypeScript config, types, and database layer. One project, one language, one `package.json`.

**Initialisation Command:**

```bash
pnpm create next-app@latest nuffield-health --typescript --tailwind --eslint --app --turbopack --import-alias "@/*"
cd nuffield-health
pnpm add playwright @anthropic-ai/sdk drizzle-orm better-sqlite3
pnpm add -D drizzle-kit @types/better-sqlite3 tsx
npx playwright install chromium
```

**Project Structure:**

```
nuffield-health/
├── src/
│   ├── app/              # Next.js dashboard (App Router)
│   ├── scraper/          # Pipeline: crawler, parser, API client, AI assessor
│   │   ├── crawl.ts      # Sitemap reader + profile fetcher
│   │   ├── parse.ts      # Heading-based HTML extractor
│   │   ├── booking.ts    # APIM API client
│   │   ├── assess.ts     # Claude Haiku quality scorer
│   │   └── run.ts        # Pipeline orchestrator (entry point)
│   ├── db/               # Drizzle schema, migrations, connection
│   │   ├── schema.ts     # Single source of truth for 40+ field types
│   │   └── index.ts      # Database connection
│   └── lib/              # Shared types, utilities, constants
├── data/                 # SQLite DB file, raw HTML cache
├── drizzle.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

**Architectural Decisions Provided by Starter:**

- **Language & Runtime:** TypeScript 5.x on Node.js 20+, strict mode
- **Styling:** Tailwind CSS 4 with utility-first approach
- **Build Tooling:** Turbopack (dev), Next.js build (production)
- **Code Organisation:** App Router file-based routing for dashboard, module-based organisation for scraper
- **Development Experience:** Hot reload for dashboard, `tsx` for running scraper scripts directly

**Note:** Project initialisation using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Semi-normalised data model (consultants table + JSON columns for arrays)
2. Three-layer validation (Zod + TypeScript + Drizzle)
3. Resume/retry via scrape_status tracking per consultant
4. Raw HTML caching to disk for auditability and re-parsing
5. Environment-based API key management (.env)

**Important Decisions (Shape Architecture):**
6. No API layer — dashboard reads SQLite directly via Server Components
7. URL-based state management for dashboard filters
8. Sequential scraping with parallel booking API calls per consultant
9. Structured error types per pipeline stage
10. Single Playwright browser instance for entire run

**Deferred Decisions (Post-MVP):**
- Cloud deployment strategy (Vercel, Railway, etc.)
- Scheduled automation (cron, GitHub Actions)
- External monitoring/alerting
- User authentication (if dashboard is exposed externally)
- PostgreSQL migration (if concurrent access needed)

### Data Architecture

**Database Model:** Semi-normalised SQLite with immutable run snapshots

| Table | Purpose |
|-------|---------|
| `scrape_runs` | One row per pipeline execution — `run_id` (UUID), `started_at`, `completed_at`, `status`, `total_profiles`, `success_count`, `error_count` |
| `consultants` | All 40+ profile fields — keyed by `(run_id, slug)`; never overwritten between runs |

**Immutability rationale:** Every reported data point must be traceable to its source evidence at the time of the report. An upsert-by-slug model silently overwrites prior evidence when the scraper re-runs, destroying point-in-time auditability. The run-scoped model retains all historical snapshots.

- `consultants` primary key: `(run_id, slug)` — a consultant scraped in run A and run B produces two rows; dashboard defaults to the latest completed `run_id`
- Array fields (treatments, insurers, flags, languages, memberships, etc.) stored as SQLite JSON columns
- Queryable via `json_each()` when needed; most dashboard queries use scalar columns and filter by `run_id`
- Raw HTML cached as files at `data/html-cache/{run_id}/{slug}.html` — never in database; directory per run preserves point-in-time HTML evidence

**Resume/Retry Strategy:**
- `scrape_status` per `(run_id, slug)`: `pending` | `crawl_done` | `parse_done` | `booking_done` | `assess_done` | `complete` | `error`
- Pipeline tracks completion at the stage level — on `--resume`, only profiles not yet at `complete` or `error` in the current `run_id` are re-processed
- A failed stage re-runs from that stage forward; completed upstream stages are not repeated
- `scrape_error` column stores failure details for debugging
- Old run records and HTML are retained until a manual pruning operation (see Data Governance)

**Validation Strategy:**
- Layer 1: Zod schemas validate scraped data at runtime before insert
- Layer 2: TypeScript types inferred from Drizzle schema at compile time
- Layer 3: Drizzle schema constraints enforce database-level integrity

### Authentication & Security

- **No user authentication** — internal management tool, localhost/intranet only
- **API keys** in `.env` file (gitignored), loaded via `process.env`
- **`.env.example`** committed with placeholder values

**Data Sensitivity Classification:**
- Non-contact profile data: **Low** — publicly available at source; no special treatment required
- Contact fields (`contact_phone`, `contact_mobile`, `contact_email`): **Medium** — personal data; controls required regardless of public availability at point of collection

**Contact Data Governance (implemented in MVP):**
- **Retention:** Run records (and associated contact data) older than `DATA_RETENTION_DAYS` (default 90) are eligible for manual pruning. No automated deletion at MVP — pruning is a documented DBA operation that removes `consultants` rows, HTML cache directory, and `scrape_runs` row for the target `run_id`.
- **Export masking:** The `/api/export` CSV route omits `contact_phone`, `contact_mobile`, and `contact_email` by default. Contact fields are included only when `EXPORT_INCLUDE_CONTACT_DATA=true` is explicitly set in `.env`. When masking is active, columns are omitted entirely — not blanked.
- **Audit logging:** Accesses to `/consultants/[slug]` (which renders contact fields) and CSV exports containing contact data are appended to `data/audit.log` with ISO timestamp, slug/export type, and requesting IP. Log is append-only.
- **Dashboard access:** Dashboard served on localhost or internal network only. Do not expose to the public internet.

**New environment variables (contact governance):**
- `DATA_RETENTION_DAYS` — days to retain run records (default 90)
- `EXPORT_INCLUDE_CONTACT_DATA` — whether CSV export includes contact fields (default `false`)

### API & Communication Patterns

- **No API layer** — Next.js Server Components query SQLite directly
- **No REST/GraphQL** — unnecessary indirection for single-user read-only dashboard
- **Future-proof:** Next.js API routes available if external consumers emerge

**Error Handling:**
- Structured types: `CrawlError`, `ParseError`, `BookingApiError`, `AiAssessmentError`
- Each captures: slug, pipeline stage, message, raw evidence
- All errors logged and persisted — never swallowed

**Rate Limiting:**
- Configurable via `.env`: `SCRAPE_DELAY_MS` (default 1500), `API_DELAY_MS` (default 500)
- Sequential page loads, parallel booking API calls per consultant

### Frontend Architecture

**Rendering:** Next.js Server Components (default), Client Components only for interactive filters, tables, and charts

**State Management:** URL search params only — no client-side state library

**Dashboard Pages:**
- `/` — Overview dashboard (quality tier chart, key metrics)
- `/consultants` — Filterable, sortable, paginated table with CSV export
- `/consultants/[slug]` — Consultant detail with field-by-field evidence and live profile link
- `/consultants/review` — **Low-confidence review queue**: profiles with any `QA_LOW_CONFIDENCE` warn flag or any `fail`-severity flag. Displays per-field confidence badge, raw extracted text evidence, and a "Mark reviewed" action that sets `manually_reviewed: true` on the record. Intended operational workflow: after each full scraper run, a reviewer works through this queue before distributing reports.

**Review Queue Operational Workflow:**
1. Scraper run completes; `score.ts` writes `QA_LOW_CONFIDENCE` flags for any field extracted at `confidence: low`
2. Reviewer opens `/consultants/review` — table shows only flagged profiles for the latest `run_id`
3. Reviewer clicks through to `/consultants/[slug]` to inspect raw extracted text alongside the live profile URL
4. Reviewer clicks "Mark reviewed" (sets `manually_reviewed = true`, `reviewed_at = now()`, `reviewed_by = reviewer_name`)
5. Reviewed profiles no longer appear in the queue; they are promoted as validated records for reporting

**Components:** shadcn/ui Table with server-side filtering via URL params

### Infrastructure & Deployment

**MVP Runtime:**
- Scraper: CLI via `npx tsx src/scraper/run.ts`
- Dashboard: `pnpm dev` (local) or `pnpm build && pnpm start`
- Database: SQLite file at `data/nuffield.db`

**Scheduling:** Manual invocation (monthly cadence)

**Environment Configuration:**
- `APIM_SUBSCRIPTION_KEY` — Nuffield booking API access
- `ANTHROPIC_API_KEY` — Claude Haiku quality assessment
- `DATABASE_PATH` — SQLite file location (default `data/nuffield.db`)
- `HTML_CACHE_PATH` — Root directory for raw HTML cache (default `data/html-cache`); run subdirectories created automatically as `{HTML_CACHE_PATH}/{run_id}/`
- `SCRAPE_DELAY_MS` — Polite crawling delay between page requests (default 1500)
- `API_DELAY_MS` — Delay between sequential API calls (default 500)
- `BOOKING_API_CONCURRENCY` — Max concurrent booking API requests (default 3)
- `DATA_RETENTION_DAYS` — Days to retain run records before pruning eligibility (default 90)
- `EXPORT_INCLUDE_CONTACT_DATA` — Include contact fields in CSV export (default `false`)

**Logging:** Structured console output with progress tracking (`[n/3814] slug — status`)

### Decision Impact Analysis

**Implementation Sequence:**
1. Project initialisation (create-next-app + dependencies)
2. Database schema (Drizzle schema + Zod validators)
3. Sitemap crawler (URL discovery)
4. Profile parser (HTML → structured data)
5. Booking API client (availability + pricing)
6. AI assessor (Haiku quality scoring)
7. Pipeline orchestrator (ties stages together with resume/retry)
8. Dashboard overview page
9. Dashboard consultant list page
10. Dashboard consultant detail page

**Cross-Component Dependencies:**
- Database schema must be defined before scraper or dashboard (both depend on it)
- Parser depends on crawler (needs HTML)
- AI assessor depends on parser (needs extracted text)
- Pipeline orchestrator depends on all scraper components
- Dashboard depends on database schema but is independent of scraper code

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 12 areas where AI agents could make different choices if not specified

### Naming Patterns

**Database Naming Conventions:**
- Tables: snake_case plural — `consultants`, `scrape_runs`
- Columns: snake_case — `consultant_name`, `profile_url`, `last_scraped_at`
- Rationale: SQL convention, matches the quick spec field definitions exactly

**Data Property Naming:**
- All data/schema properties: **snake_case** — matching the quick spec, database columns, and JSON output
- TypeScript types inferred from Drizzle use snake_case properties (`consultant.consultant_name`)
- No mapping layer between database and application — data flows through unchanged
- JSON/CSV exports use the same field names as the database

**Code Naming Conventions:**
- Files: kebab-case — `crawl.ts`, `booking-api.ts`, `consultant-card.tsx`
- Functions: camelCase — `parseProfile()`, `fetchBookingSlots()`, `assessQuality()`
- Local variables: camelCase — `pageContent`, `headingText`, `apiResponse`
- Constants: UPPER_SNAKE_CASE — `SCRAPE_DELAY_MS`, `MAX_RETRIES`, `HEADING_VARIANTS`
- Types/Interfaces: PascalCase — `Consultant`, `ScrapeRun`, `ParseResult`
- Enums: PascalCase with PascalCase members — `ScrapeStatus.Success`
- React Components: PascalCase — `ConsultantCard`, `QualityTierChart`

**Summary rule:** snake_case for data that persists or crosses boundaries, camelCase for code logic, PascalCase for types and components.

**Registration number naming — canonical disambiguation:**
- `registration_number`: the canonical schema field — always present as a string; may be non-numeric (e.g. `HCPC-OR05785`). This is the stored value.
- `gmc_code_for_booking`: derived at scoring time — `registration_number` value if it passes `/^\d+$/`, otherwise `null`. This is the value passed in booking API URL paths (`/gmc/{gmc_code_for_booking}`).
- Never use bare `gmc` as a field or variable name in schema, queries, or code — it is ambiguous between these two concepts. Use one of the two canonical names above.

### Structure Patterns

**Project Organisation:**
- Tests: co-located with source files — `parse.test.ts` beside `parse.ts`
- Dashboard components: by feature route — `/app/consultants/components/`
- Shared UI components: `/src/components/ui/` (shadcn/ui)
- Shared utilities: `/src/lib/` — constants, helpers, type utilities

**File Rules:**
- One primary export per file (component, function, or type collection)
- Index files (`index.ts`) only for re-exports from directories, never for logic
- Config constants in `/src/lib/config.ts`, not scattered across files

### Format Patterns

**Null Handling (critical for this project):**
- Missing/absent data: `null` — never `undefined`, never empty string `""`
- Empty arrays: `[]` — not `null` (treatments can be an empty list)
- Missing sections: field value is `null`, field is never omitted from the object
- Rationale: Every consultant record has the same shape. A missing treatments section produces `treatments: []`, a missing bio produces `bio_depth: null`

**Date/Time Formats:**
- Timestamps (`last_scraped_at`, `run_started_at`): ISO 8601 with timezone — `2026-02-28T14:23:01.000Z`
- Date-only fields (`next_available_date`): `YYYY-MM-DD` string — `2026-03-15`
- Year fields (`practising_since`): integer — `2004`

**Boolean Fields:**
- Always `true`/`false`, never `1`/`0`
- Field names should be self-documenting: `has_photo`, `online_bookable`, `hospital_is_nuffield`, `declaration_substantive`

### Communication Patterns

**Pipeline Logging Format:**
```
[HH:MM:SS] [STAGE] [n/total] slug — status (detail)
```
Examples:
```
[14:23:01] [CRAWL]   [1423/3814] mr-nigel-dsouza — success (200, 15 headings)
[14:23:03] [PARSE]   [1423/3814] mr-nigel-dsouza — success (42 fields, confidence: high)
[14:23:04] [BOOKING] [1423/3814] mr-nigel-dsouza — success (3 slots, £200)
[14:23:05] [AI]      [1423/3814] mr-nigel-dsouza — success (Gold tier)
[14:23:07] [CRAWL]   [1424/3814] mr-john-smith — error (404 — marked deleted)
```

**Log Levels:**
- `info` — normal progress (the format above)
- `warn` — recoverable issues (CMS corruption detected, low confidence extraction, API retry)
- `error` — failures (HTTP error, parse failure, AI response invalid)
- No `debug` level in production runs

### Process Patterns

**Error Handling:**

```typescript
// All pipeline errors extend this base
class PipelineError extends Error {
  constructor(
    message: string,
    public readonly slug: string,
    public readonly stage: 'crawl' | 'parse' | 'booking_api' | 'ai_assessment',
    public readonly cause?: unknown
  ) { super(message); }
}
```

- Errors are caught and recorded, never crash the pipeline
- Each failed profile gets `scrape_status: 'error'` + `scrape_error` with the message
- The pipeline continues to the next profile
- Summary stats logged at end of run

**Retry Strategy (bounded exponential backoff with jitter):**
- HTTP 429 (rate limited): retry up to 3 times; base delay 10s; exponential backoff (10s → 20s → 40s); ±20% jitter applied each attempt
- HTTP 503 (service unavailable): retry up to 2 times; base delay 5s; exponential backoff (5s → 10s); ±20% jitter
- HTTP 5xx (other server errors): retry once after 5s ±1s jitter
- Network timeout: retry up to 2 times after 5s ±1s jitter
- All other errors: no retry — log and move on
- Jitter formula: `delay = baseDelay * (2 ** attempt) * (0.8 + Math.random() * 0.4)`
- Constants: `MAX_RETRIES_429 = 3`, `MAX_RETRIES_503 = 2`, `MAX_RETRIES_5XX = 1`, `MAX_RETRIES_TIMEOUT = 2` (defined in `src/lib/config.ts`)

**Global API Concurrency Cap:**
- Booking API calls (clinicdays, slots, pricing) are parallelised per consultant, but the global concurrent booking API request count is capped at `BOOKING_API_CONCURRENCY` (default 3, configurable via `.env`)
- Web page scraping remains sequential per the polite-crawling requirement
- Playwright browser: single instance for the full run; page-level concurrency is 1

**Stage Checkpoints (Resumable Pipeline):**
- `scrape_status` tracks progress at stage granularity per `(run_id, slug)`: `pending` → `crawl_done` → `parse_done` → `booking_done` → `assess_done` → `complete` | `error`
- `--resume` flag re-uses the most recent incomplete `run_id` and skips any `(run_id, slug)` already at `complete`
- A failed stage re-runs from that stage forward; completed upstream stages are not repeated
- Stage transition is written to the DB atomically before the next stage begins — a mid-run crash is always recoverable

**Dashboard Loading/Error States:**
- Server Components handle loading implicitly (SSR)
- Database query errors: show a simple error message, not a stack trace
- Empty states: "No consultants match your filters" with a clear filter reset action

### AI Model Selection

**Quality Assessment Model:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)

| Factor | Rationale |
|--------|-----------|
| Task type | Structured scoring (1-5 scales, enum classifications) — does not require frontier reasoning |
| Volume | ~3,800 calls per run |
| Cost per run | ~$17 (vs ~$51 Sonnet, ~$86 Opus) |
| Latency | Fastest — critical for 3,800 sequential calls |
| Quality | Near-frontier intelligence sufficient for bio depth and treatment specificity scoring |

### Scoring Specification (`src/scraper/score.ts`)

The deterministic scoring module is the single source of truth for `profile_completeness_score`, `quality_tier`, and `flags`. It must implement the formula defined in quick-spec §3.4 exactly — any AI agent implementing `score.ts` must match these weights and thresholds without deviation.

**Field weights (implemented as constants in `src/lib/config.ts`):**

```typescript
export const SCORE_WEIGHTS = {
  has_photo: 10,
  bio_depth_substantive: 15,
  bio_depth_adequate: 10,       // partial credit
  treatments_non_empty: 10,
  qualifications_non_null: 10,
  specialty_primary_non_empty: 10,
  insurers_non_empty: 8,
  consultation_times_non_empty: 7,
  plain_english_4_plus: 10,
  plain_english_3: 5,           // partial credit
  booking_with_slots: 10,
  booking_no_slots: 5,          // partial credit
  practising_since_non_null: 5,
  memberships_non_empty: 5,
} as const; // sum of maximum values = 100
```

**Tier thresholds (enforced in `score.ts`):**

```typescript
export const TIER_THRESHOLDS = {
  gold:       { minScore: 80, mandatory: ['has_photo', 'bio_depth_substantive', 'specialty_non_empty'] },
  silver:     { minScore: 60, mandatory: ['has_photo', 'specialty_non_empty'] },
  bronze:     { minScore: 40, mandatory: ['specialty_non_empty'] },
  incomplete: { minScore: 0,  mandatory: [] },
} as const;
```

**Flag precedence (enforced in `score.ts`):**
- Any `fail` flag → cannot be `Gold`
- Two or more `fail` flags → forced to `Incomplete` (score ignored for tier assignment)
- `QA_LOW_CONFIDENCE` is always `warn`; never blocks a tier but always routes profile to `/consultants/review`

**Specialty waiver rule:**
- If `specialty_primary` matches a configured non-procedural specialty list (e.g. Psychiatry, Psychology, Pain Management — in `NON_PROCEDURAL_SPECIALTIES` constant in `src/lib/config.ts`), the `treatments_non_empty` weight is waived (no deduction for empty/absent treatments section)

---

### Enforcement Guidelines

**All AI Agents MUST:**
1. Use snake_case for any field that touches the database or appears in data output
2. Use `null` for missing values, `[]` for empty arrays — never `undefined` or `""`
3. Never swallow errors silently — log and persist every failure
4. Follow the logging format: `[TIME] [STAGE] [n/total] slug — status`
5. Keep every consultant record the same shape — all fields present, missing = `null`

**Anti-Patterns to Avoid:**
- Mixing camelCase and snake_case in database schema or data types
- Using `undefined` for missing data (breaks JSON serialisation)
- Creating wrapper objects around API responses (no `{ data: ..., error: ... }` wrappers)
- Adding try/catch blocks that catch and re-throw without adding context
- Storing raw HTML in the database (use file cache instead)

## Project Structure & Boundaries

### Complete Project Directory Structure

```
nuffield-health/
├── .env                              # API keys (gitignored)
├── .env.example                      # Template with placeholder values (committed)
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── drizzle.config.ts                 # Drizzle ORM configuration
├── components.json                   # shadcn/ui configuration
├── tailwind.config.ts
├── postcss.config.mjs
│
├── data/                             # Runtime data (gitignored)
│   ├── nuffield.db                   # SQLite database
│   ├── audit.log                     # Append-only access log for contact data
│   └── html-cache/                   # Raw HTML — scoped by run for point-in-time evidence
│       └── {run_id}/                 # UUID directory per scrape run
│           └── {slug}.html           # e.g. mr-nigel-dsouza.html
│
├── drizzle/                          # Generated migrations
│   └── *.sql
│
├── src/
│   ├── app/                          # Next.js App Router (Dashboard)
│   │   ├── globals.css
│   │   ├── layout.tsx                # Root layout with nav
│   │   ├── page.tsx                  # / — Overview dashboard
│   │   ├── consultants/
│   │   │   ├── page.tsx              # /consultants — Filterable table
│   │   │   ├── components/
│   │   │   │   ├── consultant-table.tsx      # Client: sortable/filterable table
│   │   │   │   ├── consultant-filters.tsx    # Client: filter controls
│   │   │   │   └── export-button.tsx         # Client: CSV export trigger
│   │   │   ├── review/
│   │   │   │   └── page.tsx          # /consultants/review — Low-confidence review queue
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # /consultants/[slug] — Detail view
│   │   └── api/
│   │       └── export/
│   │           └── route.ts          # GET — CSV export endpoint
│   │
│   ├── components/                   # Shared UI components
│   │   └── ui/                       # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── table.tsx
│   │       ├── badge.tsx
│   │       ├── input.tsx
│   │       └── select.tsx
│   │
│   ├── scraper/                      # Pipeline modules
│   │   ├── run.ts                    # Entry point: npx tsx src/scraper/run.ts
│   │   ├── crawl.ts                  # Sitemap XML reader + Playwright page fetcher
│   │   ├── parse.ts                  # Heading-based HTML → structured data extractor
│   │   ├── parse.test.ts             # Parser tests against known profile HTML
│   │   ├── booking.ts                # APIM API client (clinicdays, slots, pricing)
│   │   ├── booking.test.ts           # Booking API response handling tests
│   │   ├── assess.ts                 # Claude Haiku quality scorer + Zod response validation
│   │   ├── assess.test.ts            # AI response validation tests
│   │   ├── score.ts                  # Deterministic scoring (completeness, quality tier, flags)
│   │   ├── score.test.ts             # Scoring logic tests
│   │   └── headings.ts               # Heading variant dictionary + classification rules
│   │
│   ├── db/                           # Database layer
│   │   ├── schema.ts                 # Drizzle schema — single source of truth for all types
│   │   ├── index.ts                  # Database connection (better-sqlite3)
│   │   └── queries.ts                # Reusable query functions for dashboard
│   │
│   └── lib/                          # Shared utilities
│       ├── config.ts                 # Environment variables + constants
│       ├── errors.ts                 # PipelineError class hierarchy
│       ├── logger.ts                 # Structured logging ([TIME] [STAGE] format)
│       ├── validators.ts             # Zod schemas for consultant data
│       └── types.ts                  # Shared TypeScript types not in Drizzle schema
│
└── public/                           # Static assets (if any)
```

### Architectural Boundaries

**Data Boundary — the database is the integration point:**
```
Scraper (writes) → SQLite ← Dashboard (reads)
```
- The scraper and dashboard never import from each other
- Both import from `src/db/` (schema, connection, queries)
- Both import from `src/lib/` (config, types, validators)
- The database schema in `src/db/schema.ts` is the single source of truth

**Scraper Boundary — pipeline stages are independent functions:**
```
crawl(slug) → html string
parse(html) → structured data
booking(gmc) → availability + pricing
assess(profileText) → quality scores
score(data) → completeness + tier + flags
```
- Each stage takes input and returns output — no shared mutable state
- `run.ts` orchestrates the pipeline, calling each stage sequentially
- Stages can be tested in isolation with fixed input

**Dashboard Boundary — Server Components query directly:**
```
page.tsx → db/queries.ts → SQLite → rendered HTML
```
- No API layer between dashboard and database
- Server Components call query functions directly
- Client Components only for interactive UI (filters, charts)
- The single API route (`/api/export`) exists only for CSV download

### Requirements to Structure Mapping

| Requirement | Primary Files |
|-------------|---------------|
| Profile Discovery (sitemap) | `src/scraper/crawl.ts` |
| Profile Extraction (HTML parsing) | `src/scraper/parse.ts`, `src/scraper/headings.ts` |
| Booking Data (APIM APIs) | `src/scraper/booking.ts` |
| AI Quality Assessment (Haiku) | `src/scraper/assess.ts` |
| Deterministic Scoring | `src/scraper/score.ts` |
| Pipeline Orchestration | `src/scraper/run.ts` |
| Data Schema (40+ fields) | `src/db/schema.ts` |
| Data Validation (Zod) | `src/lib/validators.ts` |
| Dashboard Overview | `src/app/page.tsx` |
| Consultant List + Filters | `src/app/consultants/page.tsx`, `src/app/consultants/components/` |
| Consultant Detail | `src/app/consultants/[slug]/page.tsx` |
| Low-Confidence Review Queue | `src/app/consultants/review/page.tsx` |
| CSV Export | `src/app/api/export/route.ts` |
| Deterministic Scoring | `src/scraper/score.ts` |
| Error Handling | `src/lib/errors.ts` |
| Logging | `src/lib/logger.ts` |
| Configuration | `src/lib/config.ts`, `.env` |

### External Integration Points

| Integration | Module | Auth | Protocol |
|-------------|--------|------|----------|
| Nuffield website (scraping) | `crawl.ts` | None | Playwright HTTP |
| Nuffield sitemap XML | `crawl.ts` | None | HTTP GET |
| Booking clinicdays API | `booking.ts` | `Ocp-Apim-Subscription-Key` | REST GET |
| Booking slots API | `booking.ts` | `Ocp-Apim-Subscription-Key` | REST GET |
| Booking pricing API | `booking.ts` | `Ocp-Apim-Subscription-Key` | REST GET |
| Claude Haiku API | `assess.ts` | `ANTHROPIC_API_KEY` | Anthropic SDK |

### Data Flow

```
1. CRAWL:   sitemap.xml → URL list → Playwright → raw HTML → disk cache
2. PARSE:   cached HTML → heading classifier → structured fields → Zod validation
3. BOOKING: GMC number → 3x API calls (parallel) → availability + pricing
4. ASSESS:  profile text → Haiku prompt → JSON response → Zod validation
5. SCORE:   all fields → completeness calc → quality tier → flags array
6. STORE:   validated record → SQLite INSERT (keyed by run_id + slug) → immutable snapshot row created
7. DISPLAY: Server Component → SQL query → rendered dashboard page
```

### Development Workflow

**Running the scraper:**
```bash
npx tsx src/scraper/run.ts              # Full run
npx tsx src/scraper/run.ts --resume     # Resume from failures
npx tsx src/scraper/run.ts --slug mr-nigel-dsouza  # Single profile (dev/debug)
```

**Running the dashboard:**
```bash
pnpm dev                                # http://localhost:3000
```

**Running tests:**
```bash
pnpm test                              # All tests
pnpm test src/scraper/parse.test.ts    # Parser tests only
```

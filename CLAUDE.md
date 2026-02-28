# Nuffield Health Consultant Profile Quality Scraper

## Project Overview

Data pipeline + management dashboard that scrapes ~3,800 consultant profiles from nuffieldhealth.com, retrieves booking/pricing data via APIM APIs, runs AI quality assessment (Claude Haiku), and outputs structured data for stakeholder reporting.

## Project Layout

### BMAD Artifacts (`_bmad-output/`)
- `planning-artifacts/` — Quick Spec (v1.6), Architecture doc, Project Status (source of truth for requirements)
- `implementation-artifacts/` — QA test plan, bug reports, test results
- `implementation-artifacts/bug-reports/` — BUG-001 through BUG-007 (standardised format with spec cross-references)
- `implementation-artifacts/test-results/` — Phase-by-phase QA results (populated during testing)

### Application Code (`nuffield-health/`)
- `src/scraper/` — Pipeline: crawl → parse → booking → assess → score
- `src/db/` — Drizzle schema (SQLite), queries
- `src/lib/` — Config, errors, validators, types
- `src/app/` — Next.js dashboard (App Router)
- `data/` — SQLite DB + HTML cache (gitignored)
- `CHANGELOG.md` — Release and fix history (references bug reports in `_bmad-output/`)

## Naming Conventions — CRITICAL

- **Database columns, schema fields, JSON/CSV output:** always `snake_case` — matches the quick spec exactly
- **TypeScript functions, local variables:** `camelCase`
- **Types, interfaces, React components:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Files:** `kebab-case.ts`
- **Summary:** snake_case for data that persists or crosses boundaries, camelCase for code logic

## Registration Number Naming — NEVER use bare `gmc`

- `registration_number` — canonical schema field, always a string, may be non-numeric (e.g. `HCPC-OR05785`)
- `gmc_code_for_booking` — derived; `registration_number` value if numeric, otherwise `null`
- Never use bare `gmc` as a field or variable name — it is ambiguous

## Null Handling — CRITICAL

- Missing data: `null` — NEVER `undefined`, NEVER empty string `""`
- Empty arrays: `[]` — not `null`
- Every consultant record has the same shape — all fields present, missing = `null`

## Parser Strategy

The HTML parser uses heading text matching, NOT DOM positions or heading levels. The same section (e.g. "Special interests") can appear as H2, H3, or H4 across different profiles. Always match by text content at any heading level.

Known heading variants and edge cases are documented in quick spec §4.2.

## Error Handling

- Errors are caught and recorded, never crash the pipeline
- Each failed profile gets `scrape_status: 'error'` with details
- Pipeline continues to next profile
- Use `PipelineError` base class from `src/lib/errors.ts`

## Testing

- Test runner: Vitest
- Tests co-located with source: `parse.test.ts` beside `parse.ts`
- Run: `pnpm test` (all) or `pnpm test src/scraper/parse.test.ts` (specific)
- Current: 161 tests (117 original + 44 from bug fixes)

## Running the Scraper

```bash
cd nuffield-health
npx tsx src/scraper/run.ts                          # Full run
npx tsx src/scraper/run.ts --resume                 # Resume
npx tsx src/scraper/run.ts --slug mr-nigel-dsouza   # Single profile
```

## Key Architecture Rules

1. Scraper and dashboard never import from each other — SQLite is the integration point
2. No API layer for dashboard — Server Components query SQLite directly
3. Immutable run snapshots: keyed by `(run_id, slug)`, never overwritten
4. Raw HTML cached to `data/html-cache/{run_id}/{slug}.html`, never in DB
5. Contact fields excluded from CSV export by default (data governance)

## Current Status

- Planning: Complete (quick spec v1.6, architecture doc)
- Build: Complete (scraper pipeline + dashboard)
- Testing: In progress — Round 1 live scrape completed, 7 bugs found and fixed
- Next: Structured QA testing across broader profile sample

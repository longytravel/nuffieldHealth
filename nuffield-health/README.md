# Nuffield Health Consultant Profile Quality Scraper

A data pipeline and management dashboard that scrapes all ~3,800 consultant profiles from nuffieldhealth.com, pulls booking availability/pricing from Nuffield APIs, runs AI quality assessments, and produces structured reporting for stakeholder decision-making.

**Primary objective:** Produce a management report where every reported data point can be verified against the live profile and booking experience.

## Architecture

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.x / Node.js 20+ |
| Scraping | Playwright (JS-rendered content, iframes, expand buttons) |
| HTML Parsing | Cheerio (heading-based classification, not DOM positions) |
| AI Assessment | Claude Haiku 4.5 via @anthropic-ai/sdk |
| Database | SQLite + Drizzle ORM (immutable run snapshots) |
| Dashboard | Next.js 16 App Router + shadcn/ui + Recharts |

## Project Structure

```
src/
  scraper/         Pipeline: crawl → parse → booking → assess → score
    run.ts           Pipeline orchestrator (entry point)
    crawl.ts         Sitemap reader + Playwright page fetcher
    parse.ts         Heading-based HTML → structured data extractor
    headings.ts      Heading variant dictionary + classification
    booking.ts       APIM API client (clinicdays, slots, pricing)
    assess.ts        Claude Haiku quality scorer
    score.ts         Deterministic scoring (completeness, tier, flags)
  db/              Database layer
    schema.ts        Drizzle schema — single source of truth (40+ fields)
    queries.ts       Reusable query functions for dashboard
  lib/             Shared utilities
    config.ts        Environment variables + constants
    errors.ts        PipelineError class hierarchy
    validators.ts    Zod schemas for data validation
  app/             Dashboard (Next.js App Router)
    page.tsx              / — Overview dashboard
    consultants/
      page.tsx            /consultants — Filterable table
      review/page.tsx     /consultants/review — Low-confidence review queue
      [slug]/page.tsx     /consultants/[slug] — Detail view
    api/export/route.ts   CSV export endpoint
```

## Setup

```bash
cd nuffield-health
cp .env.example .env           # Fill in API keys
pnpm install
npx playwright install chromium
pnpm exec drizzle-kit push      # Create/migrate database
```

## Usage

### Scraper

```bash
npx tsx src/scraper/run.ts                          # Full run (~3,800 profiles)
npx tsx src/scraper/run.ts --resume                 # Resume from failures
npx tsx src/scraper/run.ts --slug mr-nigel-dsouza   # Single profile (dev/debug)
```

### Dashboard

```bash
pnpm dev          # http://localhost:3000
```

### Tests

```bash
pnpm test                              # All tests
pnpm test src/scraper/parse.test.ts    # Parser tests only
```

## Quality Tiers

| Tier | Min Score | Requirements |
|------|-----------|-------------|
| Gold | 80+ | Photo + substantive bio + specialty |
| Silver | 60+ | Photo + specialty |
| Bronze | 40+ | Specialty |
| Incomplete | <40 | Or missing mandatory fields |

## Environment Variables

See `.env.example` for all configuration options. Required keys:

- `APIM_SUBSCRIPTION_KEY` — Nuffield booking API
- `ANTHROPIC_API_KEY` — Claude Haiku quality assessment

## Planning & Architecture Docs

Full planning documentation lives in `_bmad-output/planning-artifacts/`:

- **Quick Spec** — `quick-spec-consultant-profile-scraper.md` (v1.6, 6 validation rounds)
- **Architecture** — `architecture.md` (technology decisions, data model, patterns)

## Data Governance

Contact fields (`contact_phone`, `contact_mobile`, `contact_email`) are classified as Medium sensitivity. Controls: CSV export masking by default, audit logging, localhost-only dashboard access. See quick spec §11a for full details.

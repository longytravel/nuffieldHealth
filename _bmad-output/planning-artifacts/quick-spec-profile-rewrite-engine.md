# Quick Tech Spec: Profile Rewrite Engine

**Version:** 1.0
**Date:** 2026-02-28
**Owner:** ROG (CEO initiative)
**Status:** Draft — pending review

> **v1.0:** Initial spec. Covers research pipeline, AI rewrite generation, photo download, rewrite page UX, benchmark/exemplar system, entry points across existing dashboard, performance analytics shell, and guardrails.

---

## 1. What We Are Building

A **Profile Rewrite Engine** that researches consultants on the web, corroborates findings across multiple sources, and generates improved profile content for every scored element — demonstrating what Nuffield Health's consultant profiles *could* look like.

1. **Web research pipeline** — Brave Search API to find consultant information, Claude Haiku to extract and corroborate facts
2. **AI content generation** — low-temperature rewrites for every improvable profile element, using only corroborated data
3. **Photo acquisition** — search for, download, and store consultant photographs
4. **Rewrite workspace** — a consolidated page with current vs. proposed side-by-side, benchmark exemplars, and source evidence
5. **Dashboard integration** — lightweight "rewrite" touchpoints throughout existing pages (profile detail, review queue, consultant explorer) that funnel into the rewrite workspace
6. **Performance analytics shell** — SEO scoring and search demand estimation, with infrastructure ready for real Nuffield analytics data when available

**Primary objective:** Produce a polished demo that shows stakeholders the gap between current profiles and what's achievable, backed by real research evidence.

**Scope boundary:** This is a demo/prototype. Rewritten content stays in SensAI's database — it does not push to Nuffield's CMS. All outputs are reviewed by humans before any action is taken.

---

## 2. Data Sources

| Source | What It Provides | Access Method |
|---|---|---|
| Brave Search API (free tier) | Web results for consultant research | REST API — 1,000 queries/month free |
| Brave Image Search | Consultant photographs | REST API (same subscription) |
| GMC Register | Registration status, specialty, qualification date | Included in Brave results |
| Hospital trust websites | Bios, specialties, team pages | Included in Brave results |
| Published papers (PubMed, journals) | Research activity, clinical interests | Included in Brave results |
| Royal College directories | Memberships, fellowships | Included in Brave results |
| Claude Haiku (`claude-haiku-4-5-20251001`) | Fact extraction, corroboration, content generation | Anthropic API (existing subscription) |
| Existing SensAI database | Current profile data, quality scores, top exemplars | SQLite (local) |

**Excluded sources:** LinkedIn (legal/ToS risk), social media, patient review sites.

---

## 3. Core Data Schema — New Tables

### 3.1 `profile_rewrites`

Stores every rewrite attempt. Keyed by `(rewrite_id)` with lookup by `(slug, run_id)`.

- `rewrite_id` (text, PK): UUID, generated per rewrite session
- `run_id` (text, NOT NULL): links to the scrape run whose data is being improved
- `slug` (text, NOT NULL): consultant profile slug
- `rewrite_mode` (text, NOT NULL): enum `full` | `element` — whether this was a full-profile or single-element rewrite
- `element_key` (text, nullable): which element was rewritten — `null` for full-profile rewrites. Values: `bio`, `treatments`, `qualifications`, `specialty_sub`, `memberships`, `practising_since`, `clinical_interests`, `personal_interests`, `photo`
- `original_content` (text, nullable): the content before rewrite (JSON string for array fields, plain text for text fields)
- `rewritten_content` (text, nullable): the proposed new content (same format as original)
- `source_ids` (text, nullable): JSON array of `research_source.source_id` values used for this element
- `corroboration_summary` (text, nullable): human-readable summary of what was corroborated and from where
- `projected_score_delta` (real, nullable): estimated point improvement for this element
- `projected_total_score` (real, nullable): estimated total profile score after all rewrites applied (full-profile mode only)
- `projected_tier` (text, nullable): estimated tier after rewrites — `Gold` | `Silver` | `Bronze` | `Incomplete`
- `status` (text, NOT NULL, default `draft`): enum `draft` | `accepted` | `rejected`
- `created_at` (text, NOT NULL): ISO 8601 timestamp
- `reviewed_by` (text, nullable): who reviewed this rewrite
- `reviewed_at` (text, nullable): ISO 8601 timestamp of review

**Index:** `(slug, run_id)` for lookup; `(status)` for filtering.

### 3.2 `research_sources`

Evidence trail for every piece of research found.

- `source_id` (text, PK): UUID
- `rewrite_id` (text, NOT NULL): links to the rewrite session that triggered this research
- `slug` (text, NOT NULL): consultant slug
- `search_query` (text, NOT NULL): the exact query sent to Brave Search
- `result_url` (text, NOT NULL): the URL of the search result
- `result_title` (text, nullable): page title from search results
- `page_content_snippet` (text, nullable): relevant extracted text from the page (truncated, not full page)
- `extracted_facts` (text, nullable): JSON array of structured facts extracted by Haiku
- `corroborated` (integer, NOT NULL, default 0): 1 if this fact was confirmed by another source, 0 if single-source
- `reliability_notes` (text, nullable): Haiku's assessment of source reliability
- `fetched_at` (text, NOT NULL): ISO 8601 timestamp

**Index:** `(slug, rewrite_id)` for lookup; `(corroborated)` for filtering.

### 3.3 `consultant_photos`

Downloaded consultant photographs.

- `photo_id` (text, PK): UUID
- `slug` (text, NOT NULL, UNIQUE): one photo per consultant
- `file_path` (text, NOT NULL): relative path within `data/photos/{slug}.{ext}`
- `source_url` (text, NOT NULL): where the photo was found
- `source_attribution` (text, nullable): attribution text for the photo source
- `width` (integer, nullable): image width in pixels
- `height` (integer, nullable): image height in pixels
- `file_size_bytes` (integer, nullable): file size
- `downloaded_at` (text, NOT NULL): ISO 8601 timestamp
- `verified_by` (text, nullable): human who confirmed this is the correct person
- `verified_at` (text, nullable): ISO 8601 timestamp

**Storage:** Photos saved to `data/photos/{slug}.{ext}` — gitignored, same pattern as `data/html-cache/`.

---

## 4. Research Pipeline Architecture

### 4.1 Pipeline Stages

The research pipeline runs per-consultant, per-element (or all elements for full-profile mode):

```
Search → Fetch → Extract → Corroborate → Generate → Score → Store
```

**Stage 1 — Search (Brave API)**
- Primary query: `"{consultant_name}" {specialty_primary} consultant`
- Secondary query: `"{consultant_name}" {hospital_name_primary}`
- Photo query: `"{consultant_name}" {specialty_primary} portrait photo`
- Max results per query: 10
- Filter out: LinkedIn URLs, social media, patient review sites

**Stage 2 — Fetch**
- Download page content for top 5 non-excluded results per query
- Extract text content (strip HTML), truncate to 3,000 chars per page
- Store raw snippets in `research_sources`

**Stage 3 — Extract (Haiku)**
- Send each page snippet to Haiku with a structured extraction prompt
- Extract facts per element: bio details, qualifications, memberships, treatments, clinical interests, practising since, sub-specialties
- Output: JSON array of `{ element, fact, source_url }` per page

**Stage 4 — Corroborate**
- Cross-reference extracted facts across sources
- A fact is **corroborated** if found in 2+ independent source URLs
- Single-source facts are flagged with `corroborated: 0` — they may still be used but are marked with a warning badge in the UI
- Mark each `research_source` record with its corroboration status

**Stage 5 — Generate (Haiku)**
- For each element being rewritten, send corroborated facts + current content to Haiku
- Temperature: **0.2** (minimal creativity, maximum fidelity)
- Max tokens: 500 per element, 2000 for full bio
- Prompt rules (see §5 for full prompt contract):
  - Use only facts provided — do not invent or infer
  - Write in plain English (target plain_english_score ≥ 4)
  - Match the tone and style of Gold-tier exemplar profiles
  - Flag any element where insufficient corroborated data exists — output `null` rather than hallucinate
- Output: rewritten content per element

**Stage 6 — Score**
- Run the existing scoring engine (`src/scraper/score.ts`) against the proposed content
- Calculate `projected_score_delta` per element and `projected_total_score` for the full profile
- Determine `projected_tier` using existing tier gate rules

**Stage 7 — Store**
- Persist all results to `profile_rewrites` and `research_sources`
- Store downloaded photo to `consultant_photos` and `data/photos/`

### 4.2 Batch Processing

- Batch rewrite queues multiple consultants through the pipeline sequentially
- **Warning threshold:** if batch size > 5, show confirmation dialog: *"You're about to research and rewrite {n} profiles. This will make approximately {n × 15} API calls and may take several minutes. Continue?"*
- Progress: emit progress events per-consultant — `{ current, total, slug, status }`
- Failure isolation: if one consultant fails, log the error and continue to the next (same pattern as scraper pipeline §4)

### 4.3 Rate Limiting

- Brave Search free tier: 1 query/second, 1,000/month
- Space Brave calls with 1.5s delay between requests
- Haiku: use existing rate limiting from scraper pipeline
- Track monthly Brave usage in a simple counter file (`data/brave-usage.json`) — warn at 800 queries, hard stop at 950

---

## 5. Haiku Prompt Contracts

### 5.1 Fact Extraction Prompt

**Model:** `claude-haiku-4-5-20251001` | **Temperature:** 0.3 | **Max tokens:** 1000

**Input:**
```
You are a medical research assistant extracting factual information about a healthcare consultant.

CONSULTANT: {consultant_name}
KNOWN SPECIALTY: {specialty_primary}
KNOWN HOSPITAL: {hospital_name_primary}
REGISTRATION NUMBER: {registration_number}

SOURCE URL: {source_url}
SOURCE CONTENT:
{page_content_snippet}

Extract ALL factual information about this consultant from the source. Return a JSON array of facts:

[
  { "element": "bio", "fact": "...", "confidence": "high|medium|low" },
  { "element": "qualifications", "fact": "...", "confidence": "high|medium|low" },
  { "element": "memberships", "fact": "...", "confidence": "high|medium|low" },
  { "element": "treatments", "fact": "...", "confidence": "high|medium|low" },
  { "element": "clinical_interests", "fact": "...", "confidence": "high|medium|low" },
  { "element": "sub_specialties", "fact": "...", "confidence": "high|medium|low" },
  { "element": "practising_since", "fact": "...", "confidence": "high|medium|low" },
  { "element": "personal_interests", "fact": "...", "confidence": "high|medium|low" }
]

Rules:
- Only extract facts explicitly stated in the source — do NOT infer or assume
- Confidence: "high" = directly stated with context, "medium" = mentioned but ambiguous, "low" = implied or tangential
- If the source contains no relevant information, return an empty array []
- Verify the content is about the SAME person (check name, specialty, hospital match)
- If you cannot confirm this is the same consultant, return an empty array []
```

### 5.2 Content Generation Prompt

**Model:** `claude-haiku-4-5-20251001` | **Temperature:** 0.2 | **Max tokens:** 500 per element, 2000 for bio

**Input:**
```
You are a medical copywriter improving a healthcare consultant's profile for a hospital website.

CONSULTANT: {consultant_name}
SPECIALTY: {specialty_primary}
CURRENT {element_label}: {current_content_or_null}

CORROBORATED FACTS (confirmed in 2+ sources):
{corroborated_facts_json}

SINGLE-SOURCE FACTS (use with caution, mark if used):
{single_source_facts_json}

EXEMPLAR (Gold-tier profile for reference):
{exemplar_content_for_this_element}

Write an improved {element_label} for this consultant.

Rules:
- Use ONLY the facts provided — do not invent any information
- If insufficient facts exist to write this element, return exactly: null
- Write in plain English: avoid medical jargon, use patient-friendly language
- Target reading level: accessible to a general adult audience
- Keep the tone professional, warm, and reassuring
- For biography: 150-300 words, third person, include clinical background and patient focus
- For lists (treatments, memberships, etc.): return a JSON array of strings
- If you use any single-source fact, append "(unverified)" after it
- Do not include superlatives ("best", "leading", "top") — state facts only
```

### 5.3 Validation

- All Haiku outputs validated with Zod schemas (same pattern as `src/scraper/assess.ts`)
- Bio output: `z.string().min(50).max(2000)` or `z.null()`
- List outputs: `z.array(z.string()).min(1)` or `z.null()`
- On validation failure: retry once with same prompt, then store `null` with error note
- On Haiku refusal/error: store `null`, set `rewrite_status` note, continue pipeline

---

## 6. Photo Research & Storage

### 6.1 Search Strategy

- Query Brave Image Search: `"{consultant_name}" {specialty} portrait`
- Fallback query: `"{consultant_name}" doctor photo`
- Filter: medium/large size, photo type only (not clipart/illustration)
- Take top 3 results for manual review

### 6.2 Download & Storage

- Download highest-resolution match
- Store to `data/photos/{slug}.{ext}` (jpg or png)
- Record in `consultant_photos` table with source URL and attribution
- Serve via Next.js static file serving or API route from `data/photos/`

### 6.3 Display

- On the rewrite page: show downloaded photo alongside current avatar placeholder
- On profile detail page: if `consultant_photos` record exists, render actual photo instead of initial-letter avatar
- Photo marked as `verified: false` until a human confirms it's the right person — show "Unverified" badge

### 6.4 Limitations

- Photo download is best-effort — many consultants won't have freely available photos
- Copyright: we store source attribution and display it. For production use beyond demo, Nuffield would need to source official photos
- If no suitable photo found, record `null` in the table — don't force a bad match

---

## 7. UX — Rewrite Page (`/rewrite`)

New top-level page, added to sidebar navigation between "Reports" and "Configuration".

### 7.1 Page Layout — Three Zones

**Zone A — Benchmark Bar (top, ~120px)**
- Horizontal card strip showing the **top 5 profiles** by `profile_completeness_score` from the current run
- Each card: avatar/photo, name, specialty, score gauge, tier badge
- Click any card → expands below the strip to show element-by-element breakdown of that exemplar (bio excerpt, treatments count, qualifications summary, etc.)
- When a consultant is loaded in the workspace below, show a comparison line: *"This profile: 42 → Projected: 78 | Top 5 average: 91"*

**Zone B — Rewrite Workspace (main area, split left/right)**

*Left column — Current Profile:*
- Consultant header: name, specialty, hospital, current score + tier
- Each improvable element as a card:
  - Element label + current points earned (e.g. "Biography — 0/15 pts")
  - Current content (or "Missing" placeholder if null)
  - Checkbox: "Include in rewrite" (checked by default for elements scoring below max)
  - Status pill: `Not started` | `Researching...` | `Complete` | `No data found` | `Insufficient sources`

*Right column — Proposed Rewrite:*
- Mirror layout of left column
- Each element card shows:
  - Proposed content (or "No improvement possible" if research found nothing)
  - Projected points: "0/15 → 15/15 (+15 pts)"
  - Source count badge: "3 sources" (green if corroborated) or "1 source ⚠️" (amber)
  - Expandable source evidence panel: list of URLs + extracted facts
- Bottom of right column: projected total score + projected tier with visual comparison

**Zone C — Source Evidence Panel (collapsible bottom drawer, ~200px)**
- Full evidence trail for the currently selected element
- Per source: URL (clickable), page title, extracted facts, reliability assessment
- Corroboration indicators: green checkmarks for multi-source facts, amber warnings for single-source

### 7.2 Rewrite Page Actions

- **"Research & Rewrite" button** (primary action) — triggers the research pipeline for selected elements
  - Shows progress bar: "Researching {consultant_name}... Step 3/7: Extracting facts from source 2/5"
  - Disables all other actions while running
- **"Rewrite All Checked" button** — runs generation only (skips research) using previously gathered sources
- **Element-level "Regenerate" button** — re-runs generation for a single element with different prompt variation
- **"Accept" / "Reject" per element** — marks individual elements as accepted/rejected
- **"Accept All" button** — bulk accept all proposed rewrites
- **"Export Comparison" button** — generates a PDF/HTML report showing before/after for stakeholder presentation

### 7.3 Consultant Selection

The rewrite page can be reached three ways:

1. **Direct navigation** — go to `/rewrite`, use a search/dropdown to pick a consultant
2. **From another page** — clicking a "Rewrite" action anywhere navigates to `/rewrite?slug={slug}&element={key}` with the consultant pre-loaded and optional element pre-selected
3. **Batch mode** — from consultant explorer, select multiple → "Batch Rewrite" → navigates to `/rewrite?batch={slug1,slug2,...}` which queues them and processes sequentially with a batch progress indicator

### 7.4 Batch Mode UX

- Show a queue panel at the top: list of consultants with status (pending / in progress / complete / failed)
- Current consultant's rewrite workspace shown below
- Auto-advance to next consultant when current one completes
- "Pause Batch" / "Cancel Remaining" controls
- Confirmation dialog if batch > 5: *"You're about to research and rewrite {n} profiles. This will use approximately {n × 15} API calls. Continue?"*

---

## 8. UX — Entry Points Across Dashboard

### 8.1 Consultant Profile Page (`/consultants/[slug]`)

**AI Insights tab — Recommendations panel:**
- Each recommendation row (where points are recoverable) gets an **"Improve"** button
- Click → navigates to `/rewrite?slug={slug}&element={key}`

**Overview tab — Content sections:**
- Each section header (Treatments, Qualifications, Memberships, etc.) gets a small **pencil icon** button
- Click → navigates to `/rewrite?slug={slug}&element={key}`
- The biography text (`about_text`) should now be **rendered** in the Overview tab (it's currently missing from the UI despite being in the props interface) — this is a prerequisite fix

**Quality tab — Score breakdown:**
- Each score bar that is below maximum gets an **"Improve"** action
- Click → navigates to `/rewrite?slug={slug}&element={key}`

### 8.2 Review Queue (`/consultants/review`)

- Add a **"Rewrite"** button alongside the existing "Mark Reviewed" button in the actions column
- Only shown for profiles where at least one content element is below maximum
- Click → navigates to `/rewrite?slug={slug}`

### 8.3 Consultant Explorer (`/consultants`)

- Add a **checkbox column** (first column) to the consultant table for multi-select
- Add a **"Batch Rewrite ({n} selected)"** button in the page header, visible when ≥1 row is checked
- Add a **"Rewrite"** icon button per row in the actions column alongside "View"
- Actions column width: increase from `w-[90px]` to `w-[140px]`

### 8.4 Actions Centre (`/actions`)

- No changes for v1.0. The actions page is aggregate-level, not per-profile. Future enhancement: "Rewrite all profiles missing bios" bulk action.

---

## 9. Benchmark / Exemplar System

### 9.1 Top 5 Selection

- Query: select 5 consultants with highest `profile_completeness_score` from the latest `run_id`, ordered by score descending
- Tie-breaking: prefer profiles with `bio_depth = 'substantive'` and `has_photo = true`
- Cache the top 5 in a server-side query (refreshed per page load, no separate table needed)

### 9.2 Exemplar Display (Benchmark Bar)

Each exemplar card shows:
- Photo (if available from `consultant_photos`) or initial avatar
- Name, specialty, hospital
- Score gauge (circular) + tier badge
- Expandable detail: element-by-element breakdown as a compact vertical list

### 9.3 Exemplar Content for Generation

When generating rewrites (§5.2), the top-scoring profile **within the same `specialty_primary`** is used as the exemplar in the prompt. If no same-specialty Gold profile exists, fall back to the highest-scoring profile in any specialty.

### 9.4 Within-Specialty Benchmarking

The benchmark bar can optionally filter to show "Top 5 in {specialty}" when a consultant is loaded, to provide like-for-like comparison. Toggle between "Top 5 Overall" and "Top 5 in {specialty}" via a segmented control.

---

## 10. Performance Analytics Shell

### 10.1 Profile SEO Score (Computable Now)

A derived score (0–100) assessing how well a profile would perform in search, based on content factors we can measure:

- **Keyword richness** (30 pts): does the bio mention condition names, treatment names, and symptoms that patients would search for?
- **Content length** (20 pts): bio length — 300+ words = full marks, 150-299 = partial, <150 = 0
- **Patient-friendly language** (20 pts): reuse `plain_english_score` — score ≥4 = full, 3 = partial, ≤2 = 0
- **Structured data completeness** (20 pts): proportion of scored elements that are populated
- **Location signals** (10 pts): does the profile mention the hospital location, nearby areas, or regions served?

Store as `seo_score` on the rewrite record (computed for both current and proposed content to show improvement).

### 10.2 Search Demand Estimation (Future Data)

Build the UI infrastructure now, populate later:

- **Specialty demand chart** — horizontal bar chart, each specialty with an "estimated monthly searches" value
- **Condition demand table** — conditions the consultant treats, with estimated search volumes
- Data source: placeholder values now, labelled *"Estimated — actual data pending"*
- When real data arrives (Google Search Console, GA4), the same UI components render real numbers

### 10.3 Profile Performance Dashboard (Future Data)

Shell page elements ready for real analytics:

- **Impressions & clicks chart** (line chart, date range selector) — placeholder "No data yet" state
- **CTR by element** (which profile sections correlate with clicks) — placeholder
- **Within-specialty ranking** (table: rank, name, impressions, clicks, CTR) — placeholder with quality score as proxy ranking for now

All placeholders use the `GlassCard` component with a muted "Awaiting analytics integration" message and the chart axes/labels visible but empty.

---

## 11. Guardrails & Quality Rules

### 11.1 Anti-Hallucination

- Temperature: **0.2** for generation, **0.3** for extraction (slightly higher to catch edge cases)
- Two-source corroboration enforced in code, not just in the prompt — the generation prompt only receives facts marked `corroborated: 1` in the primary section
- Single-source facts passed separately with explicit "use with caution" framing
- If generation produces content not traceable to provided facts, validation rejects it (Haiku self-check: a second call verifies each claim against sources)
- Any element where corroborated facts are insufficient → output `null`, display "Insufficient verified data" in UI

### 11.2 Plain English

- All generated content targets `plain_english_score ≥ 4`
- Generation prompt includes explicit readability rules (§5.2)
- Post-generation: run the existing AI assessment (`src/scraper/assess.ts` prompt) against the rewritten bio to get an independent `plain_english_score` — display this alongside the proposed content

### 11.3 No Superlatives or Comparative Claims

- Prompt explicitly prohibits: "best", "leading", "top", "renowned", "world-class", "unparalleled"
- Validation: simple string check against a blocklist of superlative terms — reject and regenerate if found

### 11.4 Human Review Mandatory

- All rewrites start as `status: 'draft'`
- No rewrite is ever auto-applied — must be explicitly accepted by a human
- UI makes this clear: "Accept" and "Reject" buttons, no "Apply" or "Save" that implies automatic action
- Photos require separate verification: `verified: false` until a human confirms identity

### 11.5 Source Attribution

- Every rewrite displays its source URLs
- Every fact can be traced to its origin
- Export includes source evidence alongside proposed content

---

## 12. API Routes

### 12.1 `POST /api/rewrite`

Triggers a research + rewrite pipeline for a single consultant.

**Request body:**
```json
{
  "slug": "mr-john-smith",
  "run_id": "abc123",
  "elements": ["bio", "treatments", "qualifications"],
  "mode": "full"
}
```

- `elements`: array of element keys to rewrite. If `mode: "full"`, this is ignored and all improvable elements are included.
- Returns immediately with `{ rewrite_id }` — processing is async.

**Response:**
```json
{
  "rewrite_id": "uuid-here",
  "status": "queued"
}
```

### 12.2 `GET /api/rewrite/[rewriteId]`

Poll for rewrite status and results.

**Response:**
```json
{
  "rewrite_id": "uuid",
  "status": "in_progress",
  "progress": { "current_stage": "extracting", "sources_found": 8, "facts_extracted": 23 },
  "elements": {
    "bio": { "status": "complete", "rewritten_content": "...", "sources": [...], "projected_delta": 15 },
    "treatments": { "status": "researching", "rewritten_content": null }
  },
  "projected_total_score": 78,
  "projected_tier": "Gold"
}
```

### 12.3 `POST /api/rewrite/[rewriteId]/review`

Accept or reject individual elements or the full rewrite.

**Request body:**
```json
{
  "action": "accept",
  "elements": ["bio", "treatments"]
}
```

Or for single element: `{ "action": "reject", "elements": ["qualifications"], "reason": "Inaccurate degree listed" }`

### 12.4 `POST /api/rewrite/batch`

Queue a batch of consultants for rewrite.

**Request body:**
```json
{
  "slugs": ["mr-john-smith", "dr-jane-doe", "prof-alan-jones"],
  "run_id": "abc123",
  "mode": "full"
}
```

**Response:**
```json
{
  "batch_id": "uuid",
  "queued": 3,
  "rewrite_ids": ["uuid1", "uuid2", "uuid3"]
}
```

### 12.5 `GET /api/rewrite/batch/[batchId]`

Poll batch progress.

### 12.6 `GET /api/benchmarks`

Returns top 5 profiles (or top 5 within a specialty if `?specialty=Cardiology` is provided).

**Response:**
```json
{
  "benchmarks": [
    { "slug": "...", "name": "...", "specialty": "...", "score": 95, "tier": "Gold", "elements": {...} }
  ],
  "average_score": 91.2
}
```

### 12.7 `GET /api/photos/[slug]`

Serves a consultant photo from `data/photos/`. Returns 404 if no photo exists.

---

## 13. Rewritable Elements — Complete Reference

| Element Key | DB Field(s) | Content Type | Scored? | Max Points | Research Viable? |
|---|---|---|---|---|---|
| `bio` | `about_text` | prose (string) | Yes (`bio_depth` + `plain_english`) | 25 | Yes |
| `treatments` | `treatments` | JSON string[] | Yes | 10 | Yes |
| `qualifications` | `qualifications_credentials` | prose (string) | Yes | 10 | Yes |
| `specialty_sub` | `specialty_sub` | JSON string[] | Yes (via `specialty`) | 10 | Partially |
| `memberships` | `memberships` | JSON string[] | Yes | 5 | Yes |
| `practising_since` | `practising_since` | integer (year) | Yes | 5 | Yes |
| `clinical_interests` | `clinical_interests` | JSON string[] | No (0 pts) | 0 | Yes |
| `personal_interests` | `personal_interests` | prose (string) | No (0 pts) | 0 | Limited |
| `photo` | `has_photo` + `consultant_photos` | image file | Yes | 10 | Yes |

**Not rewritable** (operational data from Nuffield):
- `insurers` (8 pts) — insurer contracts are business data
- `consultation_times_raw` (7 pts) — scheduling data
- `booking_state` (10 pts) — live availability
- `specialty_primary` — canonical, not something we'd change

**Maximum improvable points:** 75 (including `specialty_sub` contribution to `specialty` score)

---

## 14. File & Folder Structure

New files to create:

```
nuffield-health/
├── src/
│   ├── app/
│   │   └── rewrite/
│   │       ├── page.tsx                    # Rewrite workspace page (server component)
│   │       ├── rewrite-workspace.tsx       # Main workspace client component
│   │       ├── benchmark-bar.tsx           # Top 5 exemplar strip
│   │       ├── element-card.tsx            # Current/proposed element comparison card
│   │       ├── source-evidence-panel.tsx   # Collapsible evidence drawer
│   │       └── batch-queue.tsx             # Batch progress panel
│   │   └── api/
│   │       ├── rewrite/
│   │       │   ├── route.ts                # POST — trigger rewrite
│   │       │   ├── [rewriteId]/
│   │       │   │   ├── route.ts            # GET — poll status
│   │       │   │   └── review/
│   │       │   │       └── route.ts        # POST — accept/reject
│   │       │   └── batch/
│   │       │       ├── route.ts            # POST — batch trigger
│   │       │       └── [batchId]/
│   │       │           └── route.ts        # GET — batch status
│   │       ├── benchmarks/
│   │       │   └── route.ts                # GET — top 5 profiles
│   │       └── photos/
│   │           └── [slug]/
│   │               └── route.ts            # GET — serve photo
│   ├── lib/
│   │   ├── research-pipeline.ts            # Brave Search + fetch + extract orchestration
│   │   ├── rewrite-engine.ts               # Content generation + scoring
│   │   ├── brave-search.ts                 # Brave API client
│   │   ├── photo-downloader.ts             # Image search + download
│   │   └── corroboration.ts                # Fact cross-referencing logic
│   ├── db/
│   │   └── schema.ts                       # Updated — add 3 new tables
│   └── components/
│       └── ui/
│           └── rewrite-button.tsx           # Shared "Rewrite" button component
├── data/
│   ├── photos/                             # Downloaded consultant photos (gitignored)
│   └── brave-usage.json                    # API usage counter (gitignored)
```

Modified files:
- `src/components/ui/sidebar-nav.tsx` — add Rewrite nav item
- `src/app/consultants/[slug]/profile-tabs.tsx` — add "Improve" buttons, render `about_text`
- `src/app/consultants/review/page.tsx` — add "Rewrite" button to actions column
- `src/app/consultants/page.tsx` — add checkbox column and batch rewrite button
- `src/db/schema.ts` — add new tables
- `src/db/queries.ts` — add rewrite and benchmark queries

---

## 15. Acceptance Criteria

1. **Single element rewrite:** user clicks "Improve" on a consultant's bio from the profile page → navigates to rewrite page → clicks "Research & Rewrite" → progress bar shows research stages → proposed bio appears in right column with source evidence and projected score increase
2. **Full profile rewrite:** user navigates to rewrite page, selects a consultant, checks all elements → all improvable elements are researched and rewritten with projected total score and tier shown
3. **Batch rewrite:** user selects 3 consultants from explorer → clicks "Batch Rewrite" → confirmation shown → processes sequentially with queue status visible → each consultant's results are reviewable
4. **Batch warning:** selecting >5 consultants and clicking "Batch Rewrite" shows a warning dialog with estimated API calls before proceeding
5. **Corroboration:** rewritten content only uses facts found in 2+ sources. Single-source facts are visibly flagged with an amber warning badge
6. **No hallucination:** if research finds insufficient data for an element, the rewrite shows "Insufficient verified data" rather than generating content — verified by checking that `null` rewrites exist in test runs
7. **Photo download:** research pipeline finds and downloads a photo → photo appears on rewrite page and on profile detail page with "Unverified" badge → human can mark as verified
8. **Benchmark bar:** top 5 profiles display with scores and are expandable to show element-by-element breakdown
9. **Within-specialty benchmark:** when a consultant is loaded, benchmark bar can toggle to show top 5 in the same specialty
10. **Source evidence:** every rewritten element has clickable source URLs with extracted facts visible in the evidence panel
11. **Accept/reject flow:** user can accept or reject individual elements, accepted rewrites update `status` in database, rejected elements can be regenerated
12. **Plain English:** all generated bios score ≥ 4 on the existing plain English assessment when independently re-evaluated
13. **No superlatives:** generated content never contains blocked terms ("best", "leading", "top", "renowned", "world-class")
14. **Progress indicator:** research and rewrite process shows a clear progress bar with stage labels
15. **SEO score:** both current and proposed content show an SEO score, with the delta visible
16. **Entry points work:** "Improve" buttons on profile page, "Rewrite" on review queue, and checkboxes on explorer all correctly navigate to the rewrite page with the right consultant and element pre-loaded
17. **Database persistence:** all rewrites, sources, and photos are persisted and survive page refresh
18. **Brave rate limiting:** system respects 1 query/second and tracks monthly usage, warning at 800 queries

---

## 16. Decision Log

| # | Question | Decision | Spec Ref |
|---|---|---|---|
| 1 | Search API | Brave Search (free tier, 1,000 queries/month) | §2, §4.1 |
| 2 | AI model for extraction and generation | Claude Haiku (existing subscription) | §5 |
| 3 | Research sources | Web search excluding LinkedIn, social media, patient review sites | §2, §4.1 |
| 4 | Corroboration rule | Two independent sources required — enforced in code | §4.1, §11.1 |
| 5 | Temperature | 0.2 for generation, 0.3 for extraction | §5, §11.1 |
| 6 | Photo storage | Download and store locally in `data/photos/` | §6 |
| 7 | Where rewrites go | SensAI database only — demo, not pushed to Nuffield CMS | §1 |
| 8 | Human review | Mandatory — all rewrites are draft until explicitly accepted | §11.4 |
| 9 | Rewrite page structure | Single page with benchmarks + workspace + evidence | §7 |
| 10 | Batch limit | Warning dialog if >5 profiles selected | §4.2, §7.4 |
| 11 | Exemplar selection | Top 5 by score, with within-specialty toggle | §9 |
| 12 | Analytics data | Build UI shell now, populate when Nuffield provides data | §10 |
| 13 | Superlative blocking | Blocklist validation on generated content | §11.3 |

---

## 17. Risks & Mitigations

**Risk:** Brave Search free tier quota exhausted during heavy demo use
**Mitigation:** Usage tracking with warning at 800 queries. Hard stop at 950. Batch warning discourages casual bulk runs. Upgrade to paid tier ($5/month for 5,000 queries) if needed.

**Risk:** Web research finds incorrect person (common names)
**Mitigation:** Extraction prompt requires matching name + specialty + hospital. Corroboration rule means false matches from one source are filtered. Human review catches remaining errors.

**Risk:** Downloaded photos are wrong person or low quality
**Mitigation:** Photos default to "Unverified" status. Human must explicitly verify. UI clearly shows source URL for checking.

**Risk:** Haiku generates plausible-sounding but fabricated content despite guardrails
**Mitigation:** Low temperature, facts-only prompt, corroboration enforcement in code, superlative blocklist, optional self-check verification call, and mandatory human review. Multiple layers of defence.

**Risk:** Consultant has minimal web presence — research finds nothing
**Mitigation:** Pipeline handles gracefully — elements with no corroborated data output `null` with "Insufficient verified data" message. This is an expected outcome, not an error.

**Risk:** Copyright issues with downloaded photos
**Mitigation:** Source attribution stored and displayed. Demo use only — production deployment would require Nuffield to supply official photos. Clear "Demo — for illustration only" labelling.

---

## 18. Out of Scope (Future Enhancements)

- Push rewrites to Nuffield's CMS
- Real analytics data (Google Search Console, GA4) integration
- Automatic scheduled batch rewrites
- Consultant self-service review/approval portal
- Multi-language profile generation
- Video content suggestions
- A/B testing of rewritten vs. original profiles
- Integration with Nuffield's image asset management system

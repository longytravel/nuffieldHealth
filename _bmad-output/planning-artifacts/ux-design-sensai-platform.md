# UX Design Specification: SensAI Consultant Intelligence Platform

**Version:** 1.0
**Date:** 2026-02-28
**Designer:** Sally (UX Designer Agent)
**Stakeholder:** ROG (SensAI CEO)
**Status:** Draft — Awaiting Review

---

## 1. Vision Statement

> SensAI transforms 3,800+ raw consultant profiles into a living intelligence platform that tells Nuffield Health exactly where their consultant network excels, where it falls short, and precisely what to do about it — powered by AI that doesn't just score, it *advises*.

**Product name:** SensAI Consultant Intelligence Platform
**Tagline:** "Unifying Vision with AI"

---

## 2. Users & Personas

### 2.1 Executive Persona — "The Board Director"

- **Name:** Sarah, VP of Clinical Services
- **Goal:** 2-minute overview of consultant network health. Wants to see trends, compare hospitals, understand where investment is needed — then export a PDF for the next board meeting
- **Pain:** Doesn't have time for tables. Needs narrative summaries, visual KPIs, traffic-light signals
- **Key flows:** Dashboard → Executive Summary → PDF Export

### 2.2 Operational Persona — "The Hospital Manager"

- **Name:** James, Regional Operations Manager
- **Goal:** Deep-dive into his 3 hospitals. Which consultants need profile improvements? Who's not bookable? Where are the gaps?
- **Pain:** Needs to filter by his hospitals, see individual consultant issues, generate action lists for his clinical admin team
- **Key flows:** Hospital Benchmarking → Consultant Explorer → Profile Detail → Action Centre

### 2.3 Quality Analyst Persona — "The QA Reviewer"

- **Name:** Anna, Data Quality Analyst at SensAI
- **Goal:** Review flagged profiles, validate AI assessments, mark profiles as reviewed, spot anomalies
- **Pain:** Needs side-by-side comparison of AI assessment vs live profile, bulk review tools
- **Key flows:** Review Queue → Profile Detail (with live link) → Mark Reviewed → Next

---

## 3. Information Architecture

```
SensAI Platform
├── Executive Dashboard .............. /
│   ├── KPI Cards (8 metrics)
│   ├── Quality Tier Distribution
│   ├── AI Executive Summary
│   ├── Trend Sparklines
│   └── Quick Actions
├── Consultant Explorer .............. /consultants
│   ├── Advanced Filter Sidebar
│   ├── Data Grid (sortable, paginated)
│   ├── AI-Powered Search
│   └── Bulk Export
├── Consultant Profile ............... /consultants/[slug]
│   ├── Hero (photo, name, tier, score)
│   ├── Tab: Overview
│   ├── Tab: Quality Assessment
│   ├── Tab: Booking & Availability
│   ├── Tab: AI Insights & Recommendations
│   └── Tab: Raw Data (audit)
├── Hospital Benchmarking ............ /hospitals
│   ├── Hospital Cards Grid
│   ├── Comparison Radar Charts
│   └── Drill-down by Hospital
├── Specialty Analysis ............... /specialties
│   ├── Specialty Quality Heatmap
│   ├── Aggregate Metrics
│   └── Outlier Detection
├── Action Centre .................... /actions
│   ├── Prioritised Improvement Queue
│   ├── Impact Estimator
│   └── Hospital Action Plans
├── Review Queue ..................... /review
│   ├── Flagged Profiles Table
│   ├── Bulk Review Actions
│   └── AI Assessment Validation
├── Reports .......................... /reports
│   ├── Executive PDF Generator
│   ├── CSV Export Builder
│   └── Run History & Snapshots
└── AI Copilot ....................... (global overlay)
    ├── Natural Language Query Bar
    ├── Contextual Insights Panel
    └── Conversational Interface
```

---

## 4. Brand & Design System

### 4.1 Brand Hierarchy

- **Lead brand:** SensAI — drives the visual identity, colour palette, typography
- **Partner brand:** Nuffield Health — logo in header, green accent for health-related data points
- **Placement:** SensAI logo (left header) + Nuffield Health logo (right header) + "Powered by SensAI" footer

### 4.2 Colour Palette

```
BACKGROUNDS
  --bg-primary:       #0B1120    /* Deep navy — main background */
  --bg-secondary:     #111827    /* Slightly lighter — card backgrounds */
  --bg-elevated:      #1E293B    /* Elevated surfaces — modals, popovers */
  --bg-glass:         rgba(15, 23, 42, 0.7)  /* Glassmorphism panels */

BRAND — SensAI
  --sensai-teal:      #06B6D4    /* Primary accent — CTAs, highlights */
  --sensai-teal-light:#22D3EE    /* Hover states, active indicators */
  --sensai-teal-dark: #0891B2    /* Pressed states */
  --sensai-blue:      #3B82F6    /* Secondary accent — links, info */

BRAND — Nuffield Health
  --nuffield-green:   #4CAF50    /* Partner accent — health metrics */
  --nuffield-green-light: #66BB6A  /* Positive states */

DATA VISUALISATION
  --tier-gold:        #F59E0B    /* Gold tier */
  --tier-silver:      #94A3B8    /* Silver tier */
  --tier-bronze:      #D97706    /* Bronze tier */
  --tier-incomplete:  #EF4444    /* Incomplete tier */
  --success:          #10B981    /* Positive/good */
  --warning:          #F59E0B    /* Warning/attention */
  --danger:           #EF4444    /* Error/fail */
  --info:             #3B82F6    /* Informational */

TEXT
  --text-primary:     #F8FAFC    /* Primary text — high contrast on dark */
  --text-secondary:   #94A3B8    /* Secondary text — labels, descriptions */
  --text-muted:       #64748B    /* Muted text — timestamps, metadata */
  --text-accent:      #22D3EE    /* Accent text — links, highlights */

BORDERS & DIVIDERS
  --border-subtle:    rgba(148, 163, 184, 0.1)  /* Subtle card borders */
  --border-hover:     rgba(6, 182, 212, 0.3)    /* Hover border glow */
```

### 4.3 Typography

```
FONT STACK
  --font-display:     'Inter', system-ui, sans-serif   /* Headings, KPIs */
  --font-body:        'Inter', system-ui, sans-serif   /* Body text */
  --font-mono:        'JetBrains Mono', monospace      /* Data, scores, code */

SCALE
  Display:   48px / 700 weight  — Page titles, hero numbers
  H1:        32px / 600 weight  — Section headers
  H2:        24px / 600 weight  — Card titles
  H3:        18px / 500 weight  — Subsection headers
  Body:      14px / 400 weight  — Standard text
  Caption:   12px / 400 weight  — Labels, metadata
  KPI Value: 36px / 700 weight  — Dashboard numbers (mono font)
```

### 4.4 Component Patterns

**Glass Cards**
- Background: `bg-glass` with `backdrop-blur-xl`
- Border: 1px `border-subtle`, hover → `border-hover` with teal glow
- Border radius: 12px
- Shadow: subtle inset glow on hover
- Transition: 200ms ease

**KPI Cards**
- Glass card base
- Icon (top-left, teal accent, 20px)
- Label (caption, secondary text)
- Value (KPI Value size, mono font, primary text)
- Sparkline or trend indicator (bottom)
- Delta badge: +/- percentage vs previous run (green/red)

**Tier Badges**
- Pill shape, 8px horizontal padding
- Background: tier colour at 15% opacity
- Text: tier colour at full opacity
- Border: 1px tier colour at 30% opacity
- Font: 12px, 500 weight, uppercase

**Score Gauges**
- Circular arc (0-100) with gradient fill
- Colour transitions: red (0-39) → bronze (40-59) → silver (60-79) → gold (80-100)
- Center: score number in mono font
- Label beneath: quality tier text

**Data Tables**
- Dark rows with subtle alternating backgrounds
- Row hover: teal border-left glow + slight bg lighten
- Sticky header with blur
- Inline badges for tiers, flags, booking states
- Sort indicators with teal accent
- Pagination: numbered with "of N" total

**Sidebar Filters**
- Collapsible filter groups
- Checkbox groups with count badges
- Range sliders for scores
- Active filter pills at top
- "Clear All" action

**Navigation**
- Left sidebar (collapsed by default on smaller screens)
- Icons + labels for each section
- Active state: teal left border + bg highlight
- SensAI logo at top, Nuffield logo below
- User greeting: "Welcome, ROG" at bottom
- AI Copilot toggle button (pulsing teal dot)

---

## 5. Page Designs

### 5.1 Executive Dashboard — `/`

**Purpose:** The "wow" page. 10 seconds to understand network health.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ [SensAI Logo]    Consultant Intelligence    [NH Logo]    │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│ SIDEBAR │                                                │
│         │  ┌─────────────────────────────────────────┐   │
│ 📊 Dash │  │         AI EXECUTIVE SUMMARY            │   │
│ 👥 Cons │  │  "Your consultant network scores 67/100 │   │
│ 🏥 Hosp │  │   overall. 23% of profiles are Gold     │   │
│ 🔬 Spec │  │   tier — up 4% from last month..."      │   │
│ ⚡ Acts │  └─────────────────────────────────────────┘   │
│ 📋 Revw │                                                │
│ 📄 Rpts │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│         │  │3,814 │ │ 67.2 │ │  23% │ │2,847 │         │
│         │  │TOTAL │ │AVG   │ │GOLD  │ │BOOK- │         │
│         │  │PROFS │ │SCORE │ │TIER  │ │ABLE  │         │
│ ─ ─ ─ ─│  └──────┘ └──────┘ └──────┘ └──────┘         │
│         │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│         │  │  412 │ │ 3.4  │ │  187 │ │  £185│         │
│         │  │NEED  │ │PLAIN │ │MISS  │ │AVG   │         │
│ 🤖 AI  │  │REVW  │ │ENG   │ │PHOTO │ │PRICE │         │
│ Copilot │  └──────┘ └──────┘ └──────┘ └──────┘         │
│         │                                                │
│         │  ┌─────────────────┐  ┌──────────────────┐    │
│         │  │  TIER DONUT     │  │ TOP 5 QUICK      │    │
│         │  │  ● Gold   23%   │  │ ACTIONS           │    │
│         │  │  ● Silver 34%   │  │ 1. 187 missing    │    │
│         │  │  ● Bronze 28%   │  │    photos (+10pts)│    │
│         │  │  ● Incomp 15%   │  │ 2. 312 thin bios  │    │
│         │  │                 │  │    (+15pts)        │    │
│         │  │  [Animated]     │  │ 3. 94 no insurers │    │
│         │  └─────────────────┘  │    listed (+8pts)  │    │
│         │                       │ 4. ...             │    │
│         │                       └──────────────────┘    │
│         │                                                │
│         │  ┌─────────────────────────────────────────┐   │
│         │  │        HOSPITAL LEADERBOARD              │   │
│         │  │  #1 The Manor Hospital      Avg: 78.3   │   │
│         │  │  #2 Nuffield Leeds          Avg: 74.1   │   │
│         │  │  #3 Nuffield Brighton       Avg: 71.8   │   │
│         │  │  ... [View All]                          │   │
│         │  └─────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**KPI Cards (8):**
| # | Metric | Source | Sparkline |
|---|--------|--------|-----------|
| 1 | Total Active Profiles | `COUNT WHERE profile_status='active'` | Run-over-run trend |
| 2 | Average Completeness Score | `AVG(profile_completeness_score)` | Run-over-run trend |
| 3 | Gold Tier % | `COUNT(gold) / total * 100` | Run-over-run trend |
| 4 | Bookable Profiles | `COUNT WHERE booking_state='bookable_with_slots'` | Run-over-run trend |
| 5 | Needs Review | `COUNT WHERE flags IS NOT EMPTY AND manually_reviewed=false` | — |
| 6 | Avg Plain English Score | `AVG(plain_english_score)` | Distribution mini-bar |
| 7 | Missing Photos | `COUNT WHERE has_photo=false` | — |
| 8 | Avg Consultation Price | `AVG(consultation_price)` | Range indicator |

**AI Executive Summary:**
- Auto-generated narrative paragraph (Claude API call at page load or cached per run)
- Summarises: overall health, notable changes, top concerns, recommended focus areas
- "Regenerate" button, "Copy to clipboard" button, "Export as PDF" action

**Quick Actions Panel:**
- Top 5 highest-impact improvement actions ranked by `(profiles_affected × score_impact)`
- Each action: description, count of affected profiles, potential score uplift
- Click → navigates to filtered Consultant Explorer showing affected profiles

**Hospital Leaderboard:**
- Top 10 hospitals ranked by average completeness score
- Mini bar chart showing tier distribution per hospital
- Click → Hospital detail view

---

### 5.2 Consultant Explorer — `/consultants`

**Purpose:** The power tool. Find any consultant, any way.

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ FILTER SIDEBAR (280px) │         DATA GRID                 │
│                        │                                    │
│ 🔍 AI Search           │  "Showing 3,814 consultants"      │
│ "Bronze cardiologists  │  [Export CSV] [Export PDF]         │
│  in London with no     │                                    │
│  booking slots"        │  Name ▼ │Spec│Hosp│Tier│Score│Book│
│  [Search]              │  ───────┼────┼────┼────┼─────┼────│
│                        │  Mr A.. │Ort │Man │🥇  │ 87  │ ✅ │
│ ── QUALITY TIER ──     │  Dr B.. │Car │Lee │🥈  │ 72  │ ✅ │
│ ☑ Gold (876)           │  Ms C.. │Der │Bri │🥉  │ 48  │ ❌ │
│ ☑ Silver (1,296)       │  Prof.. │Neu │Lon │⚠️  │ 32  │ ✅ │
│ ☑ Bronze (1,067)       │  ...    │... │... │... │ ... │... │
│ ☐ Incomplete (575)     │                                    │
│                        │  ◀ 1 2 3 4 ... 77 ▶  (50/page)   │
│ ── BOOKING STATE ──    │                                    │
│ ☑ Bookable + Slots     │                                    │
│ ☑ Bookable, No Slots   │                                    │
│ ☐ Not Bookable         │                                    │
│                        │                                    │
│ ── HOSPITAL ──         │                                    │
│ [Search hospitals...]  │                                    │
│ ☐ The Manor Hospital   │                                    │
│ ☐ Nuffield Leeds       │                                    │
│ ☐ ...                  │                                    │
│                        │                                    │
│ ── SPECIALTY ──        │                                    │
│ [Search specialties.]  │                                    │
│                        │                                    │
│ ── SCORE RANGE ──      │                                    │
│ [====●========●===]    │                                    │
│  0         50      100 │                                    │
│                        │                                    │
│ ── FLAGS ──            │                                    │
│ ☐ Has fail flags       │                                    │
│ ☐ Has warn flags       │                                    │
│ ☐ Low AI confidence    │                                    │
│                        │                                    │
│ ── BIO DEPTH ──        │                                    │
│ ☐ Substantive          │                                    │
│ ☐ Adequate             │                                    │
│ ☐ Thin                 │                                    │
│ ☐ Missing              │                                    │
│                        │                                    │
│ ── PHOTO ──            │                                    │
│ ☐ Has Photo            │                                    │
│ ☐ Missing Photo        │                                    │
│                        │                                    │
│ [Clear All Filters]    │                                    │
└────────────────────────────────────────────────────────────┘
```

**AI-Powered Search:**
- Natural language query bar at top of filter sidebar
- Examples: "Gold tier orthopaedic surgeons at Leeds", "Consultants with thin bios and no photo", "Cheapest bookable cardiologists"
- Translates NL → filter state automatically
- Shows interpreted query: "Filtering: tier=Gold, specialty=Orthopaedics, hospital=Leeds"

**Data Grid Columns:**
| Column | Width | Content |
|--------|-------|---------|
| Consultant | 250px | Photo thumbnail + Name + Title prefix |
| Primary Specialty | 150px | First specialty badge |
| Hospital | 180px | Primary hospital name |
| Tier | 80px | Coloured tier badge |
| Score | 70px | Number + mini gauge |
| Booking | 100px | State badge + slot count |
| Flags | 60px | Count with severity colour |
| Plain English | 70px | Score 1-5 with bar |
| Actions | 80px | View / Compare buttons |

**Sorting:** Click column headers. Multi-sort with shift+click.
**Pagination:** 50 per page, numbered navigation.
**Bulk actions:** Select rows → Export Selected, Compare Selected (up to 4).

---

### 5.3 Consultant Profile — `/consultants/[slug]`

**Purpose:** Everything about one consultant. AI tells you what's good, what's missing, and what to do.

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│                      HERO SECTION                          │
│  ┌───────┐                                                 │
│  │ PHOTO │  Mr James Richardson                            │
│  │       │  Orthopaedic Surgeon                            │
│  │       │  The Manor Hospital, Oxford                     │
│  └───────┘  GMC: 4567890  │  Practising since: 2003       │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 🥇 GOLD  │  │  87/100  │  │ BOOKABLE │                 │
│  │ Quality  │  │  Score   │  │ 14 slots │                 │
│  │  Tier    │  │  ████░░  │  │ next 28d │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│                                                            │
│  [View Live Profile ↗]  [Export PDF]  [Compare]            │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Overview │ Quality │ Booking │ AI Insights │ Raw Data │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                            │
│ ═══════════════════════════════════════════════════════════ │
│                                                            │
│ [TAB: AI INSIGHTS — shown by default]                      │
│                                                            │
│  ┌─ AI RECOMMENDATIONS ──────────────────────────────────┐ │
│  │ 🎯 Priority Actions for this Profile:                 │ │
│  │                                                       │ │
│  │ 1. ✅ Photo present                         +10 pts   │ │
│  │ 2. ✅ Bio is substantive                    +15 pts   │ │
│  │ 3. ⚠️  Add insurer list                     +8 pts   │ │
│  │ 4. ⚠️  Enable online booking                +10 pts   │ │
│  │ 5. ✅ Qualifications comprehensive                    │ │
│  │                                                       │ │
│  │ Potential score if all actions taken: 87 → 95         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ AI QUALITY ASSESSMENT ───────────────────────────────┐ │
│  │                                                       │ │
│  │ Plain English: ████░ 4/5                              │ │
│  │ "Mixed approach with medical terminology (MRCP,       │ │
│  │  TAVI) alongside accessible patient-friendly          │ │
│  │  language. Generally well-written."                   │ │
│  │                                                       │ │
│  │ Bio Depth: Substantive ●                              │ │
│  │ "Detailed background including education at Oxford,   │ │
│  │  fellowship in Melbourne, 20+ year career timeline"   │ │
│  │                                                       │ │
│  │ Treatment Specificity: Highly Specific ●              │ │
│  │ "Named procedures: ACL reconstruction, meniscal       │ │
│  │  repair, hip resurfacing, rotator cuff repair"        │ │
│  │                                                       │ │
│  │ Qualifications: Comprehensive ●                       │ │
│  │ "MBBS, FRCS(Orth), MD — training at multiple         │ │
│  │  institutions with fellowship awards listed"          │ │
│  │                                                       │ │
│  │ AI Notes:                                             │ │
│  │ "Profile is well-maintained. Minor: consider adding   │ │
│  │  patient testimonials or outcome data..."             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ SCORE BREAKDOWN ────────────────────────────────────┐  │
│  │ Photo         ████████████████████  10/10            │  │
│  │ Bio Depth     ████████████████████  15/15            │  │
│  │ Treatments    ████████████████████  10/10            │  │
│  │ Qualifications████████████████████  10/10            │  │
│  │ Specialty     ████████████████████  10/10            │  │
│  │ Insurers      ░░░░░░░░░░░░░░░░░░░   0/8  ⚠️        │  │
│  │ Consult Times ████████████████████   7/7             │  │
│  │ Plain English ████████████████████  10/10            │  │
│  │ Booking       ██████████░░░░░░░░░   5/10  ⚠️        │  │
│  │ Practising    ████████████████████   5/5             │  │
│  │ Memberships   ████████████████████   5/5             │  │
│  │ ─────────────────────────────── TOTAL: 87/100        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Tabs:**

| Tab | Content |
|-----|---------|
| **Overview** | About text, specialties, treatments list, qualifications, memberships, languages, clinical interests, personal interests, professional interests, declaration |
| **Quality** | Score breakdown bar chart, tier badge, flags list with severity, AI assessment evidence (all reason fields) |
| **Booking** | Booking state, online bookable, slots next 28 days, available days, avg slots/day, next available date, days to first available, consultation price, booking caveat |
| **AI Insights** | Recommendations panel, AI assessment with reasons, improvement roadmap, comparison to specialty average |
| **Raw Data** | Full JSON dump (collapsible), metadata: slug, registration number, scrape status, run ID, timestamps |

---

### 5.4 Hospital Benchmarking — `/hospitals`

**Purpose:** Compare hospitals side-by-side. Where are the quality hotspots and cold spots?

**Features:**
- **Hospital Cards Grid:** Each hospital as a glass card showing: name, consultant count, avg score, tier distribution mini-bar, bookable %, top specialty
- **Comparison Mode:** Select 2-4 hospitals → radar chart comparing 8 dimensions:
  - Avg Completeness Score
  - Gold Tier %
  - Photo Coverage %
  - Bio Quality (% substantive)
  - Bookable %
  - Avg Plain English Score
  - Avg Slot Availability
  - Insurer Coverage %
- **Hospital Detail View:** Click hospital → full breakdown of its consultants, specialty mix, quality distribution, action items
- **Leaderboard:** Sortable ranking table with all hospitals

---

### 5.5 Specialty Analysis — `/specialties`

**Purpose:** Which specialties have the best/worst profiles? Where should improvement efforts focus?

**Features:**
- **Specialty Heatmap:** Matrix of specialty × quality dimension, colour-coded by performance
- **Specialty Cards:** Per-specialty aggregates — count, avg score, tier distribution, common flags
- **Outlier Detection:** AI-flagged specialties with unusual patterns (e.g., "Dermatology has 60% missing treatment lists — significantly above average")
- **Cross-specialty Comparison:** Select specialties → overlay distributions

---

### 5.6 Action Centre — `/actions`

**Purpose:** "What should we do first?" Prioritised improvement actions with estimated impact.

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│  ACTION CENTRE                                         │
│  "344 improvement actions across 3,814 profiles"       │
│                                                        │
│  ┌─ IMPACT SUMMARY ──────────────────────────────────┐ │
│  │ If ALL actions completed:                         │ │
│  │ Avg Score: 67.2 → 81.4 (+14.2)                   │ │
│  │ Gold Tier: 23% → 47% (+24%)                       │ │
│  │ Bookable:  74% → 74% (no change — external)       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─ PRIORITISED ACTIONS ─────────────────────────────┐ │
│  │ #  Action              Profiles  Impact  Hospital │ │
│  │ 1  Add missing photos     187    +10pts  All      │ │
│  │ 2  Expand thin bios       312    +15pts  All      │ │
│  │ 3  List insurer panels     94    +8pts   Mixed    │ │
│  │ 4  Add consultation times  78    +7pts   Mixed    │ │
│  │ 5  Add qualifications      45    +10pts  Mixed    │ │
│  │ ...                                               │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│  Filter by: [Hospital ▼] [Specialty ▼] [Impact ▼]     │
│                                                        │
│  [Generate Hospital Action Plan PDF]                   │
│  [Export Action List CSV]                              │
└────────────────────────────────────────────────────────┘
```

**Algorithm:**
Each action is scored by: `impact = profiles_affected × score_points_per_profile`
Actions are grouped by type (photo, bio, treatments, booking, etc.) and ranked by total impact.

**Hospital Action Plans:**
- Filter to a specific hospital → generates a PDF action plan
- Format: "Dear Hospital Manager, here are the top 10 improvement actions for your consultants..."
- Includes: consultant names, current scores, recommended actions, expected score after improvement

---

### 5.7 AI Copilot — Global Overlay

**Purpose:** Ask anything about the data in natural language.

**Interaction Pattern:**
- **Trigger:** Floating button (bottom-right) with pulsing teal dot, or keyboard shortcut `Cmd+K`
- **Panel:** Slides in from right as a 400px overlay panel
- **Input:** Text input with placeholder "Ask SensAI anything..."
- **Context-aware:** Knows which page you're on. On a consultant profile, it can answer "How does this consultant compare to others in their specialty?"

**Example Queries:**
- "Show me all Bronze cardiologists in London" → navigates to filtered Consultant Explorer
- "What's the average score for Leeds Hospital?" → shows answer inline with chart
- "Generate an executive summary for this month" → produces narrative text
- "Which specialty has the most missing photos?" → shows answer with data
- "Compare The Manor Hospital with Nuffield Brighton" → opens comparison view
- "What would happen if all consultants added photos?" → impact simulation

**Implementation:** Claude API call with structured context (current page, filters, aggregated data). Response rendered as formatted card in the copilot panel.

---

### 5.8 Reports — `/reports`

**Purpose:** Generate and export stakeholder-ready reports.

**Features:**
- **Executive PDF:** One-click generate a branded PDF with:
  - SensAI + Nuffield Health dual branding
  - Date and run metadata
  - KPI summary cards
  - Tier distribution chart
  - Top findings and recommendations
  - Hospital leaderboard
  - Appendix: methodology notes
- **CSV Export Builder:** Select columns, apply filters, preview, download
- **Run History:** Table of all scrape runs with metadata, status, duration
- **Snapshot Comparison:** Select two runs → show deltas (profiles added/removed, score changes, tier migrations)

---

## 6. Interaction Patterns

### 6.1 Navigation

- **Primary:** Persistent left sidebar with icon + label for each section
- **Collapse:** On smaller screens, sidebar collapses to icons only (expand on hover)
- **Breadcrumbs:** Shown on detail pages: Dashboard > Consultants > Mr James Richardson
- **Active state:** Teal left border + slight background highlight on active nav item

### 6.2 Filtering

- **Persistent:** Filters stay active when navigating between pages (URL query params)
- **Composable:** Multiple filters combine with AND logic
- **Visual feedback:** Active filter count badge on sidebar nav item
- **Clear:** "Clear All" button + individual filter dismiss (X on pill)

### 6.3 Data Loading

- **Skeleton screens:** Glass card outlines with shimmer animation while data loads
- **Progressive:** KPI cards load first, then charts, then tables
- **Caching:** Run data is immutable — aggressive caching once loaded

### 6.4 Responsive Design

| Breakpoint | Layout |
|------------|--------|
| Desktop (≥1280px) | Full sidebar + content + copilot panel |
| Tablet (≥768px) | Collapsed sidebar (icons) + content |
| Mobile (≥640px) | Bottom nav bar + full-width content |
| Small mobile (<640px) | Bottom nav + stacked cards, no table view |

---

## 7. Algorithm Specifications

### 7.1 Quick Actions Algorithm

Computes the highest-impact improvement actions across all profiles:

```
FOR EACH scoring_dimension IN [photo, bio, treatments, qualifications, ...]:
  missing_profiles = COUNT WHERE dimension_condition IS NOT MET
  potential_uplift = missing_profiles × dimension_max_points
  action = {
    dimension,
    description: "Add missing photos" / "Expand thin bios" / etc,
    profiles_affected: missing_profiles,
    avg_score_impact: dimension_max_points,
    total_impact: potential_uplift,
    affected_slugs: [list of profile slugs]
  }

SORT actions BY total_impact DESC
RETURN TOP 10
```

### 7.2 Hospital Benchmarking Algorithm

```
FOR EACH hospital:
  consultants = ALL WHERE hospital_name_primary = hospital
  metrics = {
    consultant_count: COUNT(consultants),
    avg_score: AVG(profile_completeness_score),
    gold_pct: COUNT(gold) / COUNT(all) * 100,
    photo_pct: COUNT(has_photo=true) / COUNT(all) * 100,
    bio_quality_pct: COUNT(bio_depth IN ['substantive','adequate']) / COUNT(all) * 100,
    bookable_pct: COUNT(booking_state='bookable_with_slots') / COUNT(all) * 100,
    avg_plain_english: AVG(plain_english_score),
    avg_slots: AVG(available_slots_next_28_days),
    insurer_pct: COUNT(insurer_count > 0) / COUNT(all) * 100
  }
  rank = RANK BY avg_score DESC
```

### 7.3 Specialty Outlier Detection

```
FOR EACH specialty:
  FOR EACH quality_dimension:
    specialty_avg = AVG(dimension) WHERE specialty_primary CONTAINS specialty
    global_avg = AVG(dimension) across all profiles
    z_score = (specialty_avg - global_avg) / STDDEV(dimension)
    IF abs(z_score) > 1.5:
      flag AS outlier with direction and magnitude
```

### 7.4 AI Executive Summary Generation

```
INPUT: Aggregated KPI data from current run + previous run (if exists)
PROMPT: "Generate a 3-paragraph executive summary for Nuffield Health senior leadership.
  Paragraph 1: Overall network health and key metrics.
  Paragraph 2: Notable findings, positive trends, and areas of concern.
  Paragraph 3: Top 3 recommended actions with expected impact.
  Tone: professional, concise, data-driven. Reference specific numbers."
MODEL: Claude Haiku (cost-efficient for summaries)
CACHE: Per run_id (regenerate only on new run)
```

### 7.5 AI Copilot Query Processing

```
INPUT: User natural language query + current page context + schema metadata
STEP 1: Classify query type:
  - FILTER: translate to filter params → navigate to filtered view
  - AGGREGATE: compute answer from DB → display inline
  - COMPARE: identify entities → open comparison view
  - GENERATE: produce text content → display in copilot panel
  - NAVIGATE: identify target page → navigate
STEP 2: Execute query against SQLite via structured API
STEP 3: Format response with data, charts, or navigation actions
MODEL: Claude Haiku for classification + response generation
```

---

## 8. Accessibility & Performance

### 8.1 Accessibility

- WCAG 2.1 AA compliance
- Sufficient colour contrast on dark backgrounds (all text meets 4.5:1 ratio)
- Keyboard navigable: all interactive elements focusable, tab order logical
- Screen reader: ARIA labels on all charts, data tables, and interactive elements
- Reduced motion: respect `prefers-reduced-motion` — disable animations

### 8.2 Performance

- Target: First Contentful Paint < 1.5s, Largest Contentful Paint < 2.5s
- Server Components for all data fetching (no client-side data waterfalls)
- Static generation where possible (run data is immutable)
- Chart lazy loading (load Recharts/D3 only when chart enters viewport)
- Image optimisation: Next.js Image component for consultant photos

---

## 9. Tech Stack (Confirming Existing + Additions)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 (App Router) | Already in use |
| Styling | Tailwind CSS 4 | Already in use — extend with custom design tokens |
| Components | shadcn/ui | Already in use — restyle for dark SensAI theme |
| Charts | Recharts | Already in use — extend for new chart types |
| Icons | Lucide React | Already installed |
| Animations | Framer Motion | **New** — for page transitions, card animations, gauge animations |
| Fonts | Inter + JetBrains Mono | **New** — via next/font |
| AI Copilot | Claude Haiku API | Already integrated for assessments — extend for copilot |
| PDF Export | @react-pdf/renderer or html2pdf | **New** — for branded PDF reports |
| Data | SQLite + Drizzle ORM | Already in use — add new query functions |

---

## 10. Implementation Phases

### Phase 1 — Foundation (Design System + Executive Dashboard)
- [ ] Implement SensAI dark theme design system (colours, typography, glass components)
- [ ] Rebuild layout with sidebar navigation
- [ ] Redesign Executive Dashboard with 8 KPI cards
- [ ] Add tier donut chart (animated)
- [ ] Add Quick Actions panel (algorithm §7.1)
- [ ] Add Hospital Leaderboard

### Phase 2 — Core Explorer
- [ ] Redesign Consultant Explorer with filter sidebar
- [ ] Redesign Consultant Profile with tabs and AI insights
- [ ] Add score breakdown visualisation
- [ ] Add AI recommendations per profile

### Phase 3 — Analytics
- [ ] Build Hospital Benchmarking page (radar charts, comparison)
- [ ] Build Specialty Analysis page (heatmap, outlier detection)
- [ ] Build Action Centre with prioritised actions

### Phase 4 — AI Copilot & Reports
- [ ] Build AI Copilot overlay panel
- [ ] Implement NL query → filter translation
- [ ] Build Executive PDF generator
- [ ] Build CSV Export builder
- [ ] Build Run History & Snapshot comparison

### Phase 5 — Polish
- [ ] Animations and transitions (Framer Motion)
- [ ] Responsive design (tablet + mobile)
- [ ] Accessibility audit
- [ ] Performance optimisation

---

## 11. Design Decisions (Resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | Authentication | Internal access only — no login/roles at this stage |
| 2 | Run comparison / trends | Yes — weekly scrape runs to build historical data. Trend sparklines and snapshot comparison require multi-run data |
| 3 | Real-time vs snapshot | Latest completed run snapshot. Copilot queries the most recent `completed` run |
| 4 | PDF branding | Co-branded — both SensAI and Nuffield Health logos on exported PDFs |
| 5 | Consultant photos | Link directly to Nuffield CDN (`nuffieldhealth.com`) — no local caching. Requires internet when viewing dashboard |

---

*This UX specification is the blueprint for transforming the existing dashboard into the SensAI Consultant Intelligence Platform. Every design decision serves two goals: making senior stakeholders *feel* the insight at a glance, and giving operational managers the power tools to act on it.*

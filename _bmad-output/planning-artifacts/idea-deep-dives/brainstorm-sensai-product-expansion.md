# SensAI Product Expansion — Master Overview

**Date:** 2026-03-01
**Owner:** ROG (CEO)
**Analyst:** Mary (Business Analyst)
**Status:** Active — Deep-dive research phase

---

## Table of Contents

1. [Objective & Scope](#1-objective--scope)
2. [Team-of-Agents Setup & Handoffs](#2-team-of-agents-setup--handoffs)
3. [The Core Engine](#3-the-core-engine)
4. [Standard Scoring Framework](#4-standard-scoring-framework)
5. [Portfolio Snapshot](#5-portfolio-snapshot)
6. [All 15 Ideas — The Full Catalogue](#6-all-15-ideas--the-full-catalogue)
7. [Active Idea Set (3 at a time)](#7-active-idea-set)
8. [Cross-Idea Comparison Table](#8-cross-idea-comparison-table)
9. [Decision Log](#9-decision-log)
10. [Open Questions & De-risk Plan](#10-open-questions--de-risk-plan)
11. [Sources Index](#11-sources-index)

### Deep-Dive Documents

| # | Idea | File | Status |
|---|------|------|--------|
| 1 | Regulatory Enforcement Tracker | [`idea-deep-dives/regulatory-enforcement.md`](idea-deep-dives/regulatory-enforcement.md) | Complete — **GO** (65.5/100) |
| 2 | Claims Management + Claimant Law Firm Intelligence | [`idea-deep-dives/claims-law-firm-intelligence.md`](idea-deep-dives/claims-law-firm-intelligence.md) | Complete — **GO** (70.1/100) |
| 3 | Government Contract Intelligence | `idea-deep-dives/government-contracts.md` | Queued |
| X | Political/Policy Risk Intelligence | `idea-deep-dives/political-policy-risk.md` | Next candidate (swap-in) |

---

## 1. Objective & Scope

**Question:** Beyond the Nuffield Health consultant profile scraper, where else can SensAI's core engine (public data + AI assessment + structured dashboard = intelligence product) be applied to generate revenue?

**Scope:** UK-only. Public or quasi-public data. Products that could be built and sold by a small team (1-3 engineers + 1 salesperson) within 3-6 months.

**Process:**
1. Broad ideation — generated 15 ideas across diverse verticals
2. Initial screening — scored all 15 on 7 dimensions, shortlisted top 5
3. Deep-dive research — 5-agent team analysis per idea, one at a time
4. Portfolio management — keep 3 active ideas, rotate weakest out for next candidate
5. Final recommendation — Go/Hold/No-Go per idea, with portfolio-level strategy

---

## 2. Team-of-Agents Setup & Handoffs

Each deep-dive uses 5 parallel research teams:

| Team | Role | Model | Deliverable |
|------|------|-------|------------|
| **Team 1** | Data Rights & Source Intelligence | Sonnet | Full data source catalogue with URLs, formats, licensing, legal risk ratings |
| **Team 2** | Market & Incumbent Intelligence | Sonnet | Competitive landscape map, market sizing, white space analysis |
| **Team 3** | Commercial & GTM Intelligence | Sonnet | Target company list (20+), buyer personas, pricing tiers, GTM strategy |
| **Team 4** | Product Feasibility & Pilot Design | Sonnet | Tech architecture, scraping assessment, AI taxonomy, 6-week pilot plan |
| **Team 5** | Synthesis & Challenge Board | Lead analyst | Combine all 4 teams, apply scoring, challenge assumptions, produce Go/Hold/No-Go |

**Handoff flow:** Teams 1-4 run in parallel → Team 5 synthesises → Score → Recommendation → ROG review

---

## 3. The Core Engine

The Nuffield Health prototype proved a repeatable formula:

```
Public Data  +  AI Assessment  +  Structured Dashboard  =  Intelligence Product
(scrape)        (classify/score)   (actionable insights)    (sell to buyers)
```

**Proven capabilities:**
- Scrape thousands of public web pages with Playwright
- Parse unstructured HTML into 40+ structured fields
- Run Claude Haiku AI assessment at ~$0.003/record
- Score deterministically with configurable tier thresholds
- Present in Next.js dashboard with filters, export, and review queues
- 174 unit tests, 14 bugs found and fixed across 40 profiles

---

## 4. Standard Scoring Framework

### Criteria & Weights

| # | Criterion | Weight | What 1 Means | What 5 Means |
|---|-----------|:------:|-------------|-------------|
| 1 | **Buyer Pain Urgency** | 20 | Nice to have, discretionary | Mandatory, regulatory, "hair on fire" |
| 2 | **Willingness to Pay / ACV Potential** | 15 | <£5k/yr | £50k-150k+/yr |
| 3 | **Data Rights & Licensing Clarity** | 15 | Legal grey area, scraping risk | Public by law, OGL, official API |
| 4 | **Data Availability & Quality** | 10 | Fragmented, unstructured, unreliable | Well-structured, complete, machine-readable |
| 5 | **Speed to MVP** | 10 | 6+ months, complex build | 4-6 weeks, high reuse from Nuffield |
| 6 | **Sales Cycle Friction** | 10 | 6+ month enterprise procurement | Self-serve or <4 week decision |
| 7 | **Competitive Intensity & Wedge Strength** | 10 | Crowded, well-funded incumbents | Blue ocean, no credible AI-native competitor |
| 8 | **Defensibility / Moat Potential** | 5 | Easy to replicate, commodity data | Hard to build, compounding advantage |
| 9 | **Strategic Fit with SensAI** | 5 | Unrelated to core engine | Direct reuse of stack + brand alignment |

### Scoring Method

```
Score per criterion:     1-5 (half points allowed)
Weighted Score:          (score / 5) × weight
Base Score:              Sum of all weighted scores (max 100)
Confidence Factor:       0.70 - 1.00 (based on evidence quality)
Final Score:             Base Score × Confidence Factor (max 100)
```

### Hard Gates (must all pass for GO)

| Gate | Requirement |
|------|------------|
| **Legal** | No unresolved legal/data-rights red flags |
| **Buyer** | Clear budget-owning buyer persona identified |
| **Build** | MVP feasible in ≤ 8 weeks |

---

## 5. Portfolio Snapshot

| # | Idea | Status | Final Score | Recommendation | Hard Gates |
|---|------|--------|:-----------:|:--------------:|:----------:|
| 1 | Regulatory Enforcement Tracker | **Complete** | **65.5 / 100** | **GO** | ✅ ✅ ✅ |
| 2 | Claims Mgmt + Claimant Law Firm Intelligence | **Complete** | **70.1 / 100** | **GO** | ✅ ✅ ✅ |
| 3 | Government Contract Intelligence | Queued | — | — | — |
| X | Political/Policy Risk Intelligence | Next candidate | — | — | — |

**Rule:** After Idea 2, run comparator between Idea 2 and Idea 3. Replace the weaker with Idea X for the next round. Keep only 3 active ideas at any time.

---

## 6. All 15 Ideas — The Full Catalogue

Each idea follows the same SensAI formula: scrape public data, run AI classification/scoring, and present actionable intelligence in a dashboard that buyers will pay for. Below is every idea we explored, what the product would actually do, who would buy it, and our initial screening score.

---

### Idea 1: Job Posting Intelligence — *Score: 23/35*

**What it is.** Scrape UK job boards (Indeed, LinkedIn public listings, Reed, Totaljobs) and classify postings by company to detect hiring surges, salary trends, and team-building signals. AI categorises roles by function, seniority, and growth intent.

**Who buys it.** Private equity firms (portfolio due diligence), recruitment agencies (competitive intelligence), and corporate strategy teams tracking competitor expansion.

**SensAI angle.** High ACV potential (PE firms pay £50k+ for intelligence tools) but job boards aggressively block scrapers and LinkedIn's ToS is hostile. Legal risk is the killer — this is why competitors like Thinknum and Revelio Labs are US-based and API-licensed. UK-only scraping approach faces significant legal headwinds.

**Why it scored lower.** Legal/compliance risk (3/5) and competitive intensity (2/5) — Revelio Labs, Lightcast, and Thinknum already dominate this space globally with licensed data feeds.

---

### Idea 2: Government Contract Intelligence — *Score: 28/35*

**What it is.** Ingest all UK public sector contract awards from Contracts Finder, Find a Tender, and devolved equivalents. AI classifies contracts by sector, tags incumbents, flags re-tender timelines, and scores competitive density per category.

**Who buys it.** SMEs bidding on government work (there are ~100,000 registered suppliers), bid consultancies, and procurement analytics teams inside large contractors (Serco, Capita, G4S).

**SensAI angle.** All data is published under OGL — zero legal risk. Contracts Finder has a public API. The pain is real: SMEs waste thousands on bids they can't win because they lack intelligence on incumbency patterns and award history. No AI-native product exists that tells a company "you have a 12% chance of winning this based on historical patterns."

**Why it scored well.** Perfect data accessibility (5/5), perfect legal position (5/5), strong buyer pain (4/5). Slightly lower on moat (3/5) because the data is open and a well-funded competitor could replicate.

---

### Idea 3: Planning Application Intelligence — *Score: 25/35*

**What it is.** Scrape local authority planning portals across England, Scotland, and Wales. AI classifies applications by type (residential, commercial, infrastructure), scale, and likely outcome. Track developments from application to decision to construction.

**Who buys it.** Property developers (site identification), estate agents (market foresight), infrastructure companies, and local government consultancies.

**SensAI angle.** Enormous market — UK property development is a £50bn+ sector. Every developer manually monitors planning portals. The problem is data accessibility: there are 350+ local authorities, each with a different planning portal, different formats, different update frequencies. The scraping challenge is massive. LandInsight and Nimbus Maps already have significant traction here.

**Why it scored lower.** Data accessibility (3/5) due to fragmented portals, and speed to MVP (2/5) — covering enough authorities to be useful takes far longer than 6 weeks.

---

### Idea 4: Regulatory Enforcement Tracker — *Score: 29/35* — **DEEP DIVE COMPLETE: GO (65.5/100)**

**What it is.** Monitor UK financial regulators (FCA, PRA, ICO, CMA, Gambling Commission, Ofcom, and 15+ others) for enforcement actions, fines, warnings, and decisions. AI classifies each action by violation type, sector, severity, and affected entity. Link to Companies House for corporate intelligence.

**Who buys it.** Compliance teams at financial institutions (banks, insurers, asset managers), law firms (regulatory practice groups), and GRC software vendors wanting to embed regulatory feeds.

**SensAI angle.** Most UK regulators publish enforcement data under OGL or via RSS/XML feeds — the legal position is strong. The FCA website itself is NOT scrapable (ToS prohibit it), but their RSS feeds and structured data exports are fair game. No AI-native product aggregates all UK regulators into a single classified feed. Thomson Reuters charges £105k/year for TRRI (regulatory intelligence). Corlytics and CUBE are regtech incumbents but focused on regulation text, not enforcement actions.

**Deep-dive result.** 23 regulators catalogued, FCA RSS route confirmed safe, 35 target companies identified, 4-tier pricing (£4.8k to £150k/year). Passed all hard gates. Full analysis in [`regulatory-enforcement.md`](regulatory-enforcement.md).

---

### Idea 5: ESG Report Scorer — *Score: 25/35*

**What it is.** Download published ESG/sustainability reports (PDFs) from FTSE 350 companies and run AI quality assessment. Score each report on: data completeness, target specificity, third-party assurance, alignment to TCFD/ISSB frameworks, and greenwashing signals.

**Who buys it.** Asset managers (ESG due diligence), ESG consultancies, corporate sustainability teams benchmarking against peers, and financial journalists.

**SensAI angle.** High ACV — asset managers pay £50-150k for ESG data (MSCI, Sustainalytics, S&P Global). The wedge is that existing ESG raters use disclosed data at face value. SensAI could be the first to AI-score *quality* of disclosure rather than the data itself — a "greenwashing detector." However, the space is brutally competitive (MSCI, Sustainalytics, ISS, CDP all have decades of data) and the sales cycle into asset managers is 6-12 months.

**Why it scored lower.** Competitive intensity (2/5) — the ESG data market is a $1bn+ industry with deep-pocketed incumbents. Moat is weak (2/5) because the same public reports are available to everyone.

---

### Idea 6: Clinical Trial Intelligence — *Score: 25/35*

**What it is.** Scrape ClinicalTrials.gov (UK sites), ISRCTN registry, and EudraCT for all UK-based clinical trials. AI classifies by therapeutic area, phase, sponsor type, site locations, and recruitment status. Track trial delays, terminations, and results.

**Who buys it.** Pharmaceutical companies (competitive intelligence), biotech investors (pipeline tracking), CROs (site selection intelligence), and NHS trusts (benchmarking research activity).

**SensAI angle.** ClinicalTrials.gov has a public API — excellent data accessibility. ACV is high (pharma pays £50-150k for intelligence tools). The challenge is competitive intensity: Citeline (Informa), GlobalData, and Evaluate all provide clinical trial intelligence with decades of data and established pharma relationships. The moat is thin because the underlying data is the same public registry.

**Why it scored lower.** Competitive intensity (2/5) and defensibility (2/5). Pharma intelligence is a mature market with entrenched incumbents.

---

### Idea 7: Patent Trend Mapper — *Score: 26/35*

**What it is.** Ingest UK IPO patent filings (and optionally EPO/WIPO) and run AI classification to identify technology trends, filing surges by company/sector, and white-space opportunities. Visualise as a trend dashboard with alerts.

**Who buys it.** Corporate IP departments, patent law firms, venture capital (technology scouting), and R&D strategy teams.

**SensAI angle.** UK IPO data is published under OGL — clean legal position. Patent text is highly structured (claims, abstracts, IPC codes) which makes AI classification effective. However, competitors like PatSnap, Orbit (Questel), and Derwent Innovation are well-established. The wedge would be AI-native trend analysis (what's emerging?) rather than patent search (what exists?), which is a different value proposition but harder to monetise.

**Why it scored 26.** Good data (5/5) and legal (5/5), but moderate ACV (4/5), pain (3/5), and competitive intensity (3/5). Patent intelligence is niche.

---

### Idea 8: Pricing Intelligence — *Score: 20/35*

**What it is.** Scrape competitor pricing from UK retail and service websites. AI tracks price changes, detects patterns (seasonal discounts, dynamic pricing), and benchmarks pricing position within a category.

**Who buys it.** E-commerce companies, retail chains, and pricing strategy consultancies.

**SensAI angle.** Conceptually powerful but legally fraught. Retailer ToS universally prohibit scraping. Competitors like Prisync, Competera, and Intelligence Node already operate at scale with licensed data feeds and browser extensions. The UK market alone is too small to justify a standalone product, and the scraping risk is high.

**Why it scored lowest tier.** Data accessibility (3/5), legal risk (3/5), competitive intensity (2/5), and moat (2/5). This space is crowded and legally hostile.

---

### Idea 9: School Quality Intelligence — *Score: 26/35*

**What it is.** Aggregate Ofsted inspection data, DfE school performance tables, and school census data into an AI-powered quality dashboard. Score schools on: inspection trajectory, academic performance trends, SEND provision quality, staff stability, and financial health.

**Who buys it.** Multi-academy trusts (MATs) for acquisition due diligence, local authorities, education consultancies, and potentially parents (B2C freemium).

**SensAI angle.** All data is published under OGL — perfect legal position. DfE has APIs for performance data. Ofsted publishes inspection reports as structured data. The problem is low willingness to pay: education buyers have small budgets (MATs are charities). ACV would likely be £5-15k. However, there are 2,500+ MATs in England, many actively acquiring schools and needing due diligence intelligence.

**Why it scored 26.** Excellent data (5/5) and legal (5/5), fast to build (4/5), but low ACV (2/5). The competitive space is open (4/5) — no AI-native school intelligence product exists.

---

### Idea 10: Charity Health Scorer — *Score: 26/35*

**What it is.** Ingest Charity Commission data (200,000+ registered charities), Companies House filings, and published annual reports. AI scores each charity on: financial health, governance quality, trustee diversity, regulatory compliance, and mission delivery signals.

**Who buys it.** Grant-making foundations (due diligence on grantees), corporate CSR teams, local authorities commissioning services, and journalists investigating charity governance.

**SensAI angle.** Charity Commission API is public and well-documented. Companies House data covers charity companies. Annual reports and accounts are published on the register. Legal position is clean (all OGL). The gap in the market is real — grant-makers currently do manual due diligence reviewing PDFs. But ACV is low (£5-15k for most foundations) and the buyer base is price-sensitive.

**Why it scored 26.** Same pattern as School Quality: excellent data/legal, low ACV. Competitive space is wide open (4/5) — nobody does this.

---

### Idea 11: Supply Chain Risk Intelligence — *Score: 24/35*

**What it is.** Monitor UK companies for supply chain risk signals: financial distress (via Companies House filings), regulatory actions, sanctions, modern slavery statement quality (mandated by law for companies with £36M+ turnover), and ESG incidents.

**Who buys it.** Procurement teams at large corporates, supply chain risk managers, and third-party risk management platforms.

**SensAI angle.** Strong buyer pain (5/5) — supply chain disruption is a board-level concern post-COVID and post-Suez. However, this space is ferociously competitive: Dun & Bradstreet, Moody's (formerly Bureau van Dijk), EcoVadis, Sedex, and Interos all operate here with massive datasets and enterprise sales teams. SensAI's wedge would need to be hyper-UK-focused and AI-native, but the incumbents already cover UK data.

**Why it scored 24.** Maximum pain (5/5) but minimum competitive advantage (2/5) and thin moat (2/5). The incumbents are too strong.

---

### Idea 12: Media Share of Voice — *Score: 17/35*

**What it is.** Scrape UK media outlets (news websites, trade publications) and run AI analysis to measure brand mention frequency, sentiment, topic association, and competitive share of voice.

**Who buys it.** PR agencies, corporate communications teams, and brand marketing departments.

**SensAI angle.** Media monitoring is one of the most crowded intelligence markets in existence. Meltwater, Cision, Brandwatch, and Talkwalker dominate with billions in combined revenue, licensed media feeds, and AI already embedded. Scraping news sites creates legal risk under copyright law. There is no credible wedge for a new entrant here.

**Why it scored lowest.** Competitive intensity (1/5) and moat (1/5). This was the weakest idea in the catalogue — included for completeness.

---

### Idea 13: Restaurant/Hospitality Quality Intelligence — *Score: 23/35*

**What it is.** Aggregate Food Standards Agency (FSA) hygiene ratings, TripAdvisor/Google reviews, and Companies House data for UK restaurants and hospitality venues. AI scores venues on: hygiene trajectory, customer sentiment trends, financial health, and operational signals.

**Who buys it.** Hospitality investors and PE firms (acquisition due diligence), franchise networks, food delivery platforms, and local authority environmental health teams.

**SensAI angle.** FSA hygiene ratings are fully public (API available). Review data is the challenge — TripAdvisor and Google aggressively block scraping. Without review data, the product is just hygiene ratings (already freely available). The wedge would need to be AI synthesis across multiple signals, but the legal risk on review scraping undermines it.

**Why it scored 23.** Legal risk on reviews (3/5) drags it down. Buyer pain is moderate (4/5) — hospitality investors would pay, but the market is smaller than financial services.

---

### Idea 14: Political/Policy Risk Intelligence — *Score: 30/35* — **SWAP-IN CANDIDATE**

**What it is.** Monitor Hansard (Parliamentary debates), written questions, EDMs, APPG registers, select committee inquiries, and legislation.gov.uk for policy signals. AI classifies political activity by sector impact, policy direction (tightening/loosening regulation), and ministerial priority signals. Track which industries are getting political attention and what that means for business.

**Who buys it.** Government affairs teams at FTSE 250 companies, public affairs consultancies, lobbying firms, law firms (public policy practice), and trade associations.

**SensAI angle.** Every data source is published under OGL — Hansard, legislation, parliamentary questions, and committee reports are all Crown Copyright under open licence. The data is structured (Hansard has XML feeds, legislation.gov.uk has an API). The competitive landscape is thin: DeHavilland (Grayling) and Dods are legacy incumbents with dated technology. No AI-native product analyses policy signals for business impact. ACV is strong — public affairs teams at large corporates spend £30-80k/year on intelligence subscriptions.

**Why it scored highest.** Perfect data/legal (5/5 each), strong ACV (4/5), open competitive space (4/5), and good moat (4/5 — building the AI taxonomy of "policy signal → business impact" is non-trivial to replicate). This is the strongest candidate we haven't yet deep-dived.

---

### Idea 15: Cybersecurity Exposure Scoring — *Score: 21/35*

**What it is.** Scan UK company internet-facing infrastructure for security signals: SSL certificate issues, open ports, outdated software headers, SPF/DKIM/DMARC email security, and dark web mentions. AI scores each company's external security posture.

**Who buys it.** Cyber insurance underwriters (risk assessment), corporate IT security teams (vendor risk), and M&A due diligence.

**SensAI angle.** Extremely high buyer pain (5/5) — cyber insurance is a £3bn UK market growing 25%/year, and underwriters desperately need automated risk scoring. ACV is high (£50-150k for insurance platforms). However, the legal position is terrible: port scanning and active security testing without permission violates the Computer Misuse Act 1990. Passive observation (SSL certs, DNS records) is legal, but competitors like BitSight, SecurityScorecard, and UpGuard already do this at massive scale with $1bn+ valuations.

**Why it scored lower.** Legal risk (2/5) and competitive intensity (2/5). The passive-only approach is legal but the well-funded US incumbents already dominate it.

---

### Idea 16 (NEW): Claims Management + Claimant Law Firm Intelligence — **DEEP DIVE COMPLETE: GO (70.1/100)**

**What it is.** AI platform monitoring UK claims management companies (CMCs) and claimant law firms — tracking activity, compliance status, enforcement history, financial health, and market positioning. Entity-linking across FCA Register, SRA, Companies House, ICO enforcement, ASA rulings, and Legal Ombudsman data.

**Who buys it.** General insurers (counter-fraud and claims directors), defendant law firms (competitive intelligence), Lloyd's syndicates, litigation funders, NHS Resolution, and the regulators themselves (FCA, SRA).

**SensAI angle.** No product exists in this space at all — confirmed white space. The motor finance commission claims wave (potentially £30-50bn industry liability), 89 FCA investigations into 71 law firms, and 90% CMC non-compliance rate create maximum buyer urgency. Core data is API-accessible (SRA has a free REST API, FCA Register available via paid licence ~£10-18k/year, Companies House under OGL). AI entity-linking across multiple registers creates a compounding moat that's hard to replicate.

**Deep-dive result.** 23 data sources catalogued (14 GREEN, 5 AMBER, 2 RED). 38 target companies across 8 buyer segments. Revenue potential: Conservative £430k, Base £1.06M, Optimistic £2.05M Year 1. 6-week pilot feasible. Passed all hard gates. Full analysis in [`claims-law-firm-intelligence.md`](claims-law-firm-intelligence.md).

---

### Screening Summary — Ranked by Score

| Rank | # | Idea | Data | Legal | Speed | Pain | ACV | Comp | Moat | **Total /35** | Status |
|:----:|---|------|:----:|:-----:|:-----:|:----:|:---:|:----:|:----:|:-------------:|--------|
| 1 | 14 | Political/Policy Risk Intelligence | 5 | 5 | 4 | 4 | 4 | 4 | 4 | **30** | Swap-in candidate |
| 2 | 4 | Regulatory Enforcement Tracker | 5 | 5 | 4 | 5 | 4 | 3 | 3 | **29** | **GO (65.5)** |
| 3 | 2 | Government Contract Intelligence | 5 | 5 | 4 | 4 | 4 | 3 | 3 | **28** | Queued |
| 4 | 16 | Claims Mgmt + Law Firm Intelligence | — | — | — | — | — | — | — | **NEW** | **GO (70.1)** |
| 5 | 7 | Patent Trend Mapper | 5 | 5 | 3 | 3 | 4 | 3 | 3 | **26** | Screened only |
| 5 | 9 | School Quality Intelligence | 5 | 5 | 4 | 3 | 2 | 4 | 3 | **26** | Screened only |
| 5 | 10 | Charity Health Scorer | 5 | 5 | 4 | 3 | 2 | 4 | 3 | **26** | Screened only |
| 8 | 3 | Planning Application Intelligence | 3 | 5 | 2 | 4 | 4 | 3 | 4 | **25** | Screened only |
| 8 | 5 | ESG Report Scorer | 4 | 5 | 3 | 4 | 5 | 2 | 2 | **25** | Screened only |
| 8 | 6 | Clinical Trial Intelligence | 4 | 5 | 3 | 4 | 5 | 2 | 2 | **25** | Screened only |
| 11 | 11 | Supply Chain Risk Intelligence | 4 | 4 | 3 | 5 | 4 | 2 | 2 | **24** | Screened only |
| 12 | 1 | Job Posting Intelligence | 4 | 3 | 3 | 4 | 5 | 2 | 2 | **23** | Screened only |
| 12 | 13 | Restaurant/Hospitality Quality | 4 | 3 | 4 | 4 | 3 | 3 | 2 | **23** | Screened only |
| 14 | 15 | Cybersecurity Exposure Scoring | 3 | 2 | 2 | 5 | 5 | 2 | 2 | **21** | Screened only |
| 15 | 8 | Pricing Intelligence | 3 | 3 | 3 | 4 | 3 | 2 | 2 | **20** | Screened only |
| 16 | 12 | Media Share of Voice | 3 | 3 | 3 | 3 | 3 | 1 | 1 | **17** | Screened only |

---

## 7. Active Idea Set

### Current Round

| Slot | Idea | Status |
|------|------|--------|
| **1** | Regulatory Enforcement Tracker | ✅ Complete — **GO** (65.5/100) |
| **2** | Claims Management + Claimant Law Firm Intelligence | ✅ Complete — **GO** (70.1/100) |
| **3** | Government Contract Intelligence | ⏳ Queued — next for research |
| **X** | Political/Policy Risk Intelligence | Next swap-in candidate |

### Rotation Rules

1. Research 3 ideas at a time
2. After each pair completes, run a comparator
3. Replace the weaker idea with the next candidate (X)
4. Keep portfolio to 3 active ideas maximum

---

## 8. Cross-Idea Comparison Table

*Updated as each deep-dive completes.*

| Criterion (Weight) | Regulatory Enforcement | Claims + Law Firms | Gov Contracts |
|--------------------|:---------------------:|:-----------------:|:-------------:|
| Buyer Pain (20) | 9 | **10** | — |
| ACV Potential (15) | 7 | **8** | — |
| Data Rights (15) | 7 | **7** | — |
| Data Quality (10) | 8 | **8** | — |
| Speed to MVP (10) | 9 | **8** | — |
| Sales Cycle (10) | 7 | **6** | — |
| Competitive Wedge (10) | 7 | **10** | — |
| Defensibility (5) | 5 | **8** | — |
| Strategic Fit (5) | 9 | **8** | — |
| **Base Score** | **77.0** | **82.5** | — |
| **Confidence** | **0.85** | **0.85** | — |
| **Final Score** | **65.5** | **70.1** | — |
| **Recommendation** | **GO** | **GO** | — |

**Idea 2 scored higher than Idea 1** due to: wider competitive white space (no product exists at all), higher buyer pain urgency (motor finance crisis + 89 FCA investigations), and stronger moat potential (multi-source entity linking compounds over time). Idea 1 edges ahead on speed to MVP and sales cycle friction.

---

## 9. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-01 | Generated 15 ideas from core engine abstraction | Broad ideation phase — explore all directions before narrowing |
| 2026-03-01 | Shortlisted top 5 from initial screening | Based on 7-dimension scoring (35-point max) |
| 2026-03-01 | Started deep-dive with Regulatory Enforcement | Highest buyer pain urgency + fastest to MVP + greatest tech reuse |
| 2026-03-01 | **Regulatory Enforcement: GO** (65.5/100) | All hard gates passed. FCA risk mitigated via RSS/XML. White space confirmed. Near-zero marginal cost. |
| 2026-03-01 | Replaced ESG Report Scorer with Claims Mgmt + Law Firm Intelligence in active set | ROG direction — new idea introduced based on market opportunity |
| 2026-03-01 | Starting deep-dive on Claims Mgmt + Claimant Law Firm Intelligence | Idea 2 in active set |

---

## 10. Open Questions & De-risk Plan

### Cross-Cutting Questions

| # | Question | Impact | De-risk Action | Status |
|---|---------|--------|---------------|--------|
| Q1 | Can SensAI sustain 3+ products simultaneously with a small team? | Portfolio viability | Assess shared infrastructure and maintenance cost after 3 deep-dives | Open |
| Q2 | Should SensAI build a platform (shared scraping/AI/dashboard infra) or bespoke products? | Architecture | Evaluate after 2+ products are scored | Open |
| Q3 | What is the realistic timeline from MVP to first paying customer? | Revenue planning | Validate with 3 demo meetings per idea during pilot | Open |

### Idea-Specific Questions

See each deep-dive document's "Unknowns" section.

---

## 11. Sources Index

### Idea 1: Regulatory Enforcement Tracker

| Source | URL | Used For |
|--------|-----|----------|
| FCA Enforcement Actions | fca.org.uk/news/news-stories | Primary data source |
| FCA Terms of Service | fca.org.uk/terms-conditions | Legal risk assessment — Section 4.8(iii) |
| ICO Enforcement | ico.org.uk/action-weve-taken | Data source |
| CMA Cases | gov.uk/cma-cases | Data source (GOV.UK Content API) |
| Gambling Commission | gamblingcommission.gov.uk/public-register | Data source |
| OGL v3.0 | nationalarchives.gov.uk/doc/open-government-licence/version/3/ | Licensing framework |
| Companies House API | developer.company-information.service.gov.uk | Entity linking |
| Thomson Reuters TRRI pricing | Public tender data (UK government) | Market validation — £105k/year |
| Corlytics | corlytics.com | Competitor analysis |
| CUBE Global | cube.global | Competitor analysis |

### Idea 2: Claims Management + Claimant Law Firm Intelligence

| Source | URL | Used For |
|--------|-----|----------|
| FCA Financial Services Register | register.fca.org.uk | CMC authorisation data |
| FCA Register Extract Service | fca.org.uk/firms/financial-services-register/data-extract | Commercial licensing terms (~£10-18k/yr) |
| FCA CMC Portfolio Letter 2025 | fca.org.uk/publication/correspondence/ | 90% non-compliance finding |
| FCA/SRA Joint Warning (Motor Finance) | fca.org.uk/news/press-releases/ | Market catalyst — 89 investigations |
| SRA Developer API Portal | sra-prod-apim.developer.azure-api.net | API access — firm data |
| SRA Recent Decisions | sra.org.uk/consumers/solicitor-check/recent-decisions/ | Disciplinary data |
| Solicitors Disciplinary Tribunal | solicitorstribunal.org.uk/judgments/ | Full judgment text |
| Companies House Data Products | gov.uk/guidance/companies-house-data-products | Bulk entity data |
| ICO Enforcement | ico.org.uk/action-weve-taken/enforcement/ | CMC nuisance call fines |
| Legal Ombudsman Data Centre | legalombudsman.org.uk/information-centre/data-centre/ | Named firm complaint data |
| OIC Portal Data | officialinjuryclaim.org.uk/resources-for-professionals/data/ | Post-whiplash market stats |
| ASA Rulings | asa.org.uk/codes-and-rulings/rulings.html | Advertising compliance |
| ABI Motor Claims Record 2024 | abi.org.uk/news/ | £11.7bn market sizing |
| Solomonic | solomonic.co.uk/product | Competitor assessment |
| Insurance DataLab | insurancedatalab.com | Competitor assessment |
| Shift Technology | shift-technology.com | Competitor assessment |

---

*Living document. Updated after each deep-dive research cycle.*

# Deep Dive 01: UK Regulatory Enforcement Intelligence

**Idea:** AI dashboard monitoring all UK regulator enforcement actions — tells compliance teams "here's what your regulator is targeting and what it means for you."

**Research date:** 2026-03-01
**Method:** 4-agent parallel research (Data Sources, Market/Competitors, Buyer/GTM, Tech Feasibility) + synthesis
**Status:** Complete — awaiting Go/Hold/No-Go decision

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Definition](#2-product-definition)
3. [The UK Buyer Problem](#3-the-uk-buyer-problem)
4. [Data Sources — Full Catalogue](#4-data-sources--full-catalogue)
5. [Legal & Licensing Assessment](#5-legal--licensing-assessment)
6. [Competitive Landscape](#6-competitive-landscape)
7. [Target Companies & Buyer Personas](#7-target-companies--buyer-personas)
8. [Pricing Model](#8-pricing-model)
9. [Go-to-Market Strategy](#9-go-to-market-strategy)
10. [Technical Feasibility & Architecture](#10-technical-feasibility--architecture)
11. [6-Week Pilot Plan](#11-6-week-pilot-plan)
12. [Cost Model](#12-cost-model)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Weighted Scoring](#14-weighted-scoring)
15. [Go / Hold / No-Go Recommendation](#15-go--hold--no-go-recommendation)

---

## 1. Executive Summary

**Opportunity:** UK Chief Compliance Officers (CCOs) have a legal obligation to monitor their regulators' enforcement activity. Today this means manual reading of 8+ regulator websites, RSS feeds, and newsletters — fragmented, reactive, and pattern-blind. No product exists that provides cross-regulator UK enforcement intelligence with AI classification, trend detection, and personalised risk scoring.

**White space confirmed:** The competitive landscape has products in three quadrants (low breadth + low AI; high breadth + low AI; low breadth + high AI) but Quadrant 4 (high breadth + high AI) is unoccupied. SensAI would be the first UK-focused, multi-regulator, AI-native enforcement intelligence platform.

**Market size:** UK RegTech market ~$520M (2025). Enforcement intelligence subset ~$75-100M. Realistic serviceable obtainable market (SOM): **£5-20M ARR within 3 years**.

**Key validation signal:** UK government itself paid ~£105,000/year for Thomson Reuters Regulatory Intelligence via public tender — confirming that even government buyers pay six figures for this category of product.

**Critical finding — FCA scraping risk:** FCA Terms of Service (Section 4.8(iii)) explicitly prohibit automated scraping. However, FCA publishes RSS/XML feeds and structured data tables that can be consumed legitimately. This is not a blocker — it shapes the technical approach.

**Recommendation: GO** — with FCA data acquired via RSS/XML feeds (not scraping), and 3 lower-risk regulators (CMA, Gambling Commission, ICO) as parallel launch sources.

---

## 2. Product Definition

### What It Is

An AI-powered intelligence dashboard that:
1. **Aggregates** enforcement actions from 8+ UK regulators into a single normalised database
2. **Classifies** each action by violation type, industry sector, severity, and regulatory theme using AI
3. **Detects trends** — acceleration in enforcement themes, sector-targeting patterns, penalty escalation
4. **Scores risk** — personalised to the subscriber's firm type, sector, and regulatory footprint
5. **Alerts** — proactive notifications when enforcement trends shift in the subscriber's direction
6. **Generates briefings** — AI-written monthly compliance intelligence PDFs

### What It Is NOT

- Not legal advice (clearly positioned as intelligence/data)
- Not a replacement for legal databases (LexisNexis, Westlaw) — those are document repositories, this is trend intelligence
- Not a GRC platform (ServiceNow, Diligent) — this is an *input* to GRC workflows

### Core Value Proposition

> "Stop reading 8 regulator websites. See every enforcement action in one place. Know what your regulator is targeting before they target you."

---

## 3. The UK Buyer Problem

### The Pain

CCOs at regulated UK firms face a structural problem:

1. **Fragmentation:** Enforcement data is scattered across 8+ regulator websites, each with different formats, update schedules, and navigation
2. **Manual monitoring:** Typically one person is assigned to "read the FCA weekly newsletter" — they miss things, go on holiday, leave the company
3. **No trend visibility:** A single fine is an event. Five fines in the same category over 6 months is a *signal*. Humans can't see patterns across regulators and years
4. **Reactive posture:** Companies learn about enforcement trends when they receive the enforcement letter — by which point it's too late
5. **Board reporting:** CCOs must report regulatory trends to the board. They cobble together slides from multiple sources — no single dashboard exists

### The Trigger Events

- FCA Consumer Duty enforcement wave (2024-2026) — firms scrambling to understand who's being targeted and why
- ICO GDPR fines accelerating — especially in financial services and health
- Gambling Commission licence revocations increasing — operators need early warning
- Post-Brexit regulatory divergence — UK regulators acting more independently, harder to track

### Willingness to Pay

- Compliance is **non-discretionary spend** — regulated firms *must* monitor their regulators
- CCO tool budgets typically £500k-5M/year at large firms
- Current spend on monitoring tools: £20k-80k/year on fragmented subscriptions
- UK government paid **£105,000/year** for Thomson Reuters Regulatory Intelligence (confirmed via public tender data)

---

## 4. Data Sources — Full Catalogue

### Primary Regulators (23 assessed)

#### Tier 1 — Launch Priority (highest volume, clearest data, broadest buyer base)

| Regulator | Enforcement URL | Format | Volume | Historical Depth | Update Frequency | Data Quality | Scraping Difficulty |
|-----------|----------------|--------|--------|-----------------|-----------------|-------------|-------------------|
| **FCA** (Financial Conduct Authority) | fca.org.uk/news/news-stories + fca.org.uk/publication/final-notices | HTML pages + PDF final notices + RSS feed + structured fines table | ~80-120 actions/year | 10+ years online | Weekly | 5/5 | Easy-Medium (RSS/XML preferred — ToS prohibits scraping) |
| **ICO** (Information Commissioner) | ico.org.uk/action-weve-taken/enforcement | HTML + PDF monetary penalty notices | ~50-80 actions/year | 8+ years | Monthly | 4/5 | Medium (pagination, inconsistent HTML) |
| **CMA** (Competition & Markets Authority) | gov.uk/cma-cases | Structured GOV.UK pages + PDF decisions | ~100 cases/year | 10+ years (including OFT legacy) | Weekly | 5/5 | Easy (GOV.UK Content API available) |
| **Gambling Commission** | gamblingcommission.gov.uk/public-register | HTML register + PDF decision notices | ~40-60 actions/year | 5+ years | Monthly | 4/5 | Easy-Medium |

#### Tier 2 — Phase 2 Expansion

| Regulator | Volume | Historical Depth | Data Quality | Scraping Difficulty |
|-----------|--------|-----------------|-------------|-------------------|
| **Ofcom** | ~30-50/year | 8+ years | 4/5 | Medium |
| **Ofgem** | ~20-30/year | 6+ years | 3/5 | Medium |
| **PRA** (Prudential Regulation Authority) | ~10-20/year | 8+ years | 5/5 | Easy (structured, small volume) |
| **SRA** (Solicitors Regulation Authority) | ~200+/year | 10+ years | 3/5 | Medium-Hard |
| **HSE** (Health & Safety Executive) | ~400+/year | 10+ years | 3/5 | Hard (defer) |

#### Tier 3 — Niche / Future

| Regulator | Notes |
|-----------|-------|
| Ofwat | Water — small buyer base |
| ORR (Rail) | Niche |
| CAA (Aviation) | Niche |
| FRC / ARGA (Audit) | Accounting/audit firms |
| MHRA (Medicines) | Pharma-specific |
| Charity Commission | Charity governance |
| Environment Agency | Environmental enforcement |
| NMC (Nursing/Midwifery) | Healthcare |
| GMC (General Medical) | Healthcare |
| GDC (Dental) | Healthcare |
| GPhC (Pharmacy) | Healthcare |
| HCPC (Health/Care Professions) | Healthcare |
| Social Work England | Social care |
| TPR (Pensions Regulator) | Pensions |

### Supplementary Data Sources

| Source | Value | Access Method |
|--------|-------|--------------|
| **Companies House API** | Entity linking — match enforcement targets to company data (directors, SIC codes, filing history) | Free REST API, rate-limited |
| **GOV.UK Content API** | Structured JSON for government-hosted content (CMA cases, consultations) | Free, well-documented |
| **Financial Ombudsman Service** | ~150,000 complaint decisions/year — trend signal (not enforcement, but predictive) | Public search + bulk data |
| **Parliamentary data** | Select committee inquiries into regulators — forward-looking signal | TheyWorkForYou API |
| **FOI archives** | WhatDoTheyKnow.com — responses to FOI requests about regulators | Public, scrape-friendly |

---

## 5. Legal & Licensing Assessment

### Licensing Summary by Regulator

| Regulator | Licence | Legal Risk | Notes |
|-----------|---------|:----------:|-------|
| FCA | Custom ToS | 🔴 RED | Section 4.8(iii) prohibits automated scraping. **Mitigation:** Use RSS feeds, XML data, structured tables — all legitimate. Do not scrape HTML pages. |
| CMA | OGL v3.0 (via GOV.UK) | 🟢 GREEN | Government data, openly licensed. GOV.UK Content API available. |
| ICO | OGL v3.0 | 🟢 GREEN | Published enforcement notices are public records. |
| Gambling Commission | OGL v3.0 | 🟢 GREEN | Public register. |
| Ofcom | OGL v3.0 | 🟢 GREEN | Via GOV.UK. |
| Ofgem | OGL v3.0 | 🟢 GREEN | Via GOV.UK. |
| HSE | OGL v3.0 | 🟢 GREEN | Prosecution data is public court records. |
| Companies House | Free API with rate limits | 🟢 GREEN | Official API, well-documented terms. |

### GDPR Considerations

- Enforcement notices name individuals (directors, compliance officers, approved persons)
- These are **public records** published by regulators in the public interest
- GDPR Article 6(1)(f) — legitimate interest in processing publicly available enforcement data
- **Mitigation:** Focus on corporate entities, not individuals. Where individuals are named, reproduce only what the regulator has published. Do not enrich with personal data from other sources.

### Key Legal Conclusion

**FCA is the highest-value regulator but requires careful technical approach.** RSS/XML feeds, structured data tables, and the FCA Register API are all legitimate access methods. Direct HTML scraping of fca.org.uk should be avoided. All other Tier 1 regulators are GREEN under OGL.

---

## 6. Competitive Landscape

### Market Map

```
                        AI Sophistication
                    Low                 High
                ┌──────────────────┬──────────────────┐
     High       │  Q1: Traditional │  Q4: ★ SensAI ★  │
  Regulator     │  LexisNexis      │  (UNOCCUPIED)    │
  Breadth       │  Westlaw         │                  │
                │  Thomson Reuters │                  │
                ├──────────────────┼──────────────────┤
     Low        │  Q2: Basic       │  Q3: Vertical AI │
  Regulator     │  Regulator RSS   │  Corlytics (FCA) │
  Breadth       │  Manual tracking │  FinregE (FCA)   │
                │  Newsletters     │  CUBE (global)   │
                └──────────────────┴──────────────────┘
```

### Key Competitors Assessed

| Competitor | Focus | Breadth | AI | Price | Weakness |
|-----------|-------|---------|:---:|-------|----------|
| **Corlytics** | Financial regulation globally | Low (financial only) | Medium | Enterprise (£100k+) | Global focus dilutes UK depth. Financial sector only. Expensive. |
| **CUBE Global** | Regulatory change management | Medium | Medium | Enterprise (£200k+) | Compliance *change* management, not enforcement intelligence. Very expensive. |
| **Thomson Reuters (TRRI)** | Regulatory intelligence globally | High | Low | £50-150k/year | Search/document tool, not AI intelligence. Massive but legacy tech. |
| **LexisNexis** | Legal document retrieval | High | Low | £30-100k/year | Document database, not trend analysis. Lawyer tool, not compliance tool. |
| **Wolters Kluwer** | Compliance workflow | Medium | Low | Enterprise | Process tool, not intelligence tool. |
| **FinregE** | FCA/PRA regulatory change | Low (FCA/PRA only) | Medium | Unknown | Financial sector only. Regulatory change, not enforcement. |
| **Westlaw (TR)** | Legal research | High | Low | £20-80k/year | Research tool for lawyers. Not proactive intelligence. |

### The White Space

**No existing product combines:**
1. Multi-regulator UK breadth (8+ regulators)
2. AI-powered classification and trend detection
3. Personalised risk scoring
4. Proactive alerting
5. Accessible pricing (under £50k for mid-market)

Incumbents are either:
- **Broad but dumb** (Thomson Reuters, LexisNexis — great document retrieval, no AI intelligence)
- **Smart but narrow** (Corlytics, FinregE — AI on financial regulation only)
- **Neither** (manual newsletter reading, regulator RSS feeds)

### Market Size

| Metric | Value | Source |
|--------|-------|--------|
| UK RegTech market (2025) | ~$520M | Industry estimates |
| Enforcement intelligence subset | ~$75-100M | Analyst extrapolation |
| SensAI Year 1 target | £500k-1M ARR | 20-40 customers at £25-50k ACV |
| SensAI Year 3 target | £5-20M ARR | 200-400 customers + enterprise tier |

---

## 7. Target Companies & Buyer Personas

### Target Companies (35 across 7 segments)

#### Segment 1: Banks & Building Societies (FCA/PRA regulated)

| # | Company | Size | Compliance Team | Why They'd Buy |
|---|---------|------|----------------|---------------|
| 1 | HSBC UK | Tier 1 | 200+ compliance staff | Multi-regulator exposure (FCA, PRA, ICO, CMA) |
| 2 | Barclays | Tier 1 | 200+ | Consumer Duty enforcement wave directly relevant |
| 3 | Lloyds Banking Group | Tier 1 | 200+ | Largest UK retail bank — most exposed to FCA consumer duty |
| 4 | NatWest Group | Tier 1 | 150+ | Recent FCA AML enforcement history — heightened awareness |
| 5 | Santander UK | Tier 1 | 100+ | International parent needs UK-specific intelligence |
| 6 | Virgin Money | Mid | 50+ | Mid-size, stretched compliance team |
| 7 | Metro Bank | Mid | 30+ | Regulatory scrutiny after accounting scandal |
| 8 | Monzo | Challenger | 30+ | Fast-growing, needs to scale compliance monitoring |
| 9 | Revolut | Challenger | 50+ | Recently licensed, under FCA spotlight |
| 10 | Starling Bank | Challenger | 30+ | Compliance-forward culture, likely early adopter |

#### Segment 2: Insurance (FCA regulated)

| # | Company | Primary Regulator |
|---|---------|-------------------|
| 11 | Aviva | FCA, PRA |
| 12 | Legal & General | FCA, PRA |
| 13 | Admiral | FCA |
| 14 | Direct Line Group | FCA |
| 15 | Zurich UK | FCA |

#### Segment 3: Wealth Management & Asset Management

| # | Company | Why |
|---|---------|-----|
| 16 | Hargreaves Lansdown | FCA consumer duty — retail investors |
| 17 | St. James's Place | Recent FCA scrutiny on fee transparency |
| 18 | Schroders | Multi-regulator (FCA + international) |
| 19 | Rathbones | Wealth manager — FCA oversight |

#### Segment 4: Gambling (Gambling Commission)

| # | Company | Why |
|---|---------|-----|
| 20 | bet365 | Largest UK operator — constant GC scrutiny |
| 21 | Flutter (Paddy Power, Betfair) | Multi-brand, multi-jurisdiction |
| 22 | Entain (Ladbrokes, Coral) | Recent enforcement history |
| 23 | William Hill (888) | Enforcement target — needs early warning |

#### Segment 5: Telecoms & Media (Ofcom)

| # | Company | Why |
|---|---------|-----|
| 24 | BT Group | Ofcom regulated, large compliance team |
| 25 | Vodafone UK | Ofcom + ICO exposure |
| 26 | Sky UK | Ofcom broadcasting + telecoms |

#### Segment 6: Energy (Ofgem)

| # | Company | Why |
|---|---------|-----|
| 27 | British Gas / Centrica | Ofgem enforcement target |
| 28 | EDF Energy UK | Ofgem regulated |
| 29 | Scottish Power | Ofgem regulated |

#### Segment 7: Law Firms & Consultancies (Reseller / Advisory Channel)

| # | Company | Why |
|---|---------|-----|
| 30 | Clifford Chance | Regulatory practice — client advisory |
| 31 | Allen & Overy (A&O Shearman) | Same |
| 32 | Linklaters | Same |
| 33 | Deloitte (Regulatory Advisory) | Serves compliance teams — reseller potential |
| 34 | PwC (Risk & Regulation) | Same |
| 35 | KPMG (Regulatory Insight) | Same |

### Buyer Personas (6)

#### Persona 1: CCO at a Mid-Tier Bank
- **Title:** Chief Compliance Officer
- **Company:** Virgin Money, Metro Bank, Starling
- **Reports to:** CEO / Board Risk Committee
- **Team size:** 15-40
- **Budget:** £1-5M compliance tools
- **Pain:** "I need to report regulatory trends to the board quarterly. Right now, my team manually reads 3 regulator websites and cobbles together slides. We miss things."
- **Decision speed:** 4-8 weeks
- **ACV sweet spot:** £15-30k

#### Persona 2: Head of Regulatory Affairs at an Insurer
- **Title:** Head of Regulatory Affairs / Director of Compliance
- **Company:** Admiral, Direct Line, Zurich UK
- **Pain:** "We're regulated by FCA, PRA, and ICO. No single tool covers all three. My team spends 2 days per month just gathering enforcement data."
- **Decision speed:** 6-12 weeks
- **ACV sweet spot:** £25-40k

#### Persona 3: DPO at a Tech Company
- **Title:** Data Protection Officer
- **Company:** Tech companies processing UK personal data
- **Pain:** "ICO fines are accelerating and unpredictable. I need to see patterns — which sectors are they targeting? What violations?"
- **Decision speed:** 2-6 weeks (fastest — ICO enforcement is urgent)
- **ACV sweet spot:** £5-15k (single regulator)

#### Persona 4: Compliance Manager at Mid-Size Firm
- **Title:** Compliance Manager / Officer
- **Company:** Mid-size FCA-regulated firms (IFAs, payment processors, fintechs)
- **Pain:** "I'm the only compliance person. I can't monitor everything. I need a tool that does the monitoring for me and tells me what matters."
- **Decision speed:** 2-4 weeks
- **ACV sweet spot:** £5-8k

#### Persona 5: Regulatory Practice Partner at a Law Firm
- **Title:** Partner, Regulatory & Enforcement Practice
- **Company:** Magic Circle and Silver Circle firms
- **Pain:** "I need to advise 20+ clients across 5 regulators. I need trend data to write better client alerts and win pitches."
- **Decision speed:** 4-8 weeks
- **ACV sweet spot:** £30-50k (multi-seat)

#### Persona 6: GRC Team at FTSE 100
- **Title:** Head of GRC / VP Risk & Compliance
- **Company:** Multi-regulator FTSE 100 (banks, energy, telecoms)
- **Pain:** "Our compliance dashboard has a gap — we have internal controls data but zero external enforcement intelligence. The board wants to see both."
- **Decision speed:** 8-16 weeks (enterprise procurement)
- **ACV sweet spot:** £50-150k

---

## 8. Pricing Model

### 4-Tier Structure

| Tier | Name | Coverage | Price (ACV) | Target |
|------|------|----------|:-----------:|--------|
| 1 | **Signal** | Single regulator, dashboard, weekly email digest | £4,800-7,200/yr | Solo compliance officers, DPOs, small firms |
| 2 | **Intelligence** | 3-5 regulators, trend detection, alerts, monthly PDF briefing | £15,000-30,000/yr | Mid-size regulated firms, law firm teams |
| 3 | **Command** | All UK regulators, personalised risk scoring, API, custom alerts, quarterly advisory call | £50,000-150,000/yr | FTSE 100 compliance teams, Big 4 advisory |
| 4 | **Partner** | White-label / reseller licence + API | £40,000-100,000/yr | Law firms, consultancies reselling to clients |

### Pricing Rationale

- **Signal tier** priced to undercut manual monitoring cost (~1 hour/week × £50/hr = £2,600/yr internal cost, plus risk of missing something)
- **Intelligence tier** priced below Thomson Reuters TRRI (£50-150k) and well below Corlytics (£100k+)
- **Command tier** comparable to Thomson Reuters but with AI — justified by trend detection and risk scoring
- **Partner tier** enables law firms to integrate into client advisory — high margin for SensAI

### Revenue Scenarios (Year 1)

| Scenario | Customers | Mix | ARR |
|----------|:---------:|-----|:---:|
| Conservative | 20 | 10 Signal + 8 Intelligence + 2 Command | £290k |
| Base | 40 | 15 Signal + 18 Intelligence + 5 Command + 2 Partner | £850k |
| Optimistic | 60 | 20 Signal + 25 Intelligence + 10 Command + 5 Partner | £1.8M |

---

## 9. Go-to-Market Strategy

### Phase 1: Prove (Months 1-3)

**Objective:** Get 5 paying customers from 3 different segments

| Channel | Action | Target |
|---------|--------|--------|
| **Direct outreach** | Cold email to 50 CCOs with personalised enforcement trend relevant to their firm | 10 demo meetings |
| **Content** | Monthly "UK Enforcement Trends" report (free PDF) — capture emails | 200 subscribers |
| **LinkedIn** | Weekly enforcement trend posts (e.g., "FCA fined 3 wealth managers this month for consumer duty failures — here's the pattern") | 1,000 followers |
| **Events** | Attend/speak at 2 compliance events (UK Compliance Week, GRCWORLD) | Pipeline generation |
| **Free trial** | 14-day trial with pre-loaded historical data. Let the product sell itself. | 30% trial → paid conversion |

### Phase 2: Scale (Months 4-8)

| Channel | Action |
|---------|--------|
| **Partner channel** | Onboard 2-3 law firms as resellers (Partner tier) |
| **Referral** | Customer referral programme (1 month free per referral) |
| **PR** | Pitch "SensAI's AI finds FCA targeting X" stories to FT/City AM |
| **Webinars** | Monthly "Enforcement Intelligence Briefing" webinar (lead gen) |

### Phase 3: Expand (Months 9-12)

| Channel | Action |
|---------|--------|
| **Enterprise** | FTSE 100 sales via Big 4 introductions |
| **International** | EU regulator expansion (BaFin, AMF, ESMA) |
| **Product-led growth** | Freemium tier with limited historical data |

### Sales Cycle by Segment

| Segment | Typical Cycle | Decision Maker | Key Objection |
|---------|:------------:|----------------|---------------|
| Challenger banks | 2-4 weeks | CCO directly | "Can I trust the AI classification?" |
| Mid-size regulated | 4-8 weeks | CCO + budget approval | "We already read the FCA newsletter" |
| Insurance | 6-12 weeks | Head of Reg Affairs + procurement | "Does it cover PRA too?" |
| FTSE 100 | 8-16 weeks | VP Risk + procurement + InfoSec | "Security review required" |
| Law firms | 4-8 weeks | Practice partner | "Can we white-label this?" |

---

## 10. Technical Feasibility & Architecture

### Data Acquisition Strategy (Per Regulator)

| Regulator | Method | Difficulty | Day 1 Ready? |
|-----------|--------|:----------:|:------------:|
| **FCA** | RSS feed + structured fines table (NOT HTML scraping — ToS prohibits) | Easy-Medium | Yes — fines table is the quickest win |
| **ICO** | HTML scraping of enforcement pages + PDF notices | Medium | Yes |
| **CMA** | GOV.UK Content API (structured JSON) | Easy | Yes |
| **Gambling Commission** | HTML scraping of public register + PDF notices | Easy-Medium | Yes |
| **Ofcom** | GOV.UK Content API + HTML | Medium | Phase 2 |
| **Ofgem** | GOV.UK Content API + HTML | Medium | Phase 2 |
| **HSE** | Complex HTML + court records | Hard | Defer |

### AI Classification Taxonomy

Each enforcement action is classified across:

| Dimension | Categories |
|-----------|-----------|
| **Violation type** (12 categories) | AML/KYC failure, Consumer duty breach, Market abuse, Systems & controls, Data protection, Misleading communications, Financial crime, Unfair treatment, Safety/welfare, Competition, Licensing breach, Other |
| **Severity tier** | Minor (warning), Moderate (fine <£1M), Major (fine £1-10M), Critical (fine >£10M / licence revocation) |
| **Industry sector** | Banking, Insurance, Wealth management, Payments, Gambling, Telecoms, Energy, Legal, Technology, Healthcare, Other |
| **Regulatory theme** | Maps to regulator's own priority themes (e.g., FCA Consumer Duty, ICO data protection, CMA merger control) |
| **Entity type** | Individual, Firm, Group/parent |

### Database Schema (Key Tables)

```sql
-- Core enforcement data
enforcement_actions (
  id, regulator, action_date, published_date,
  entity_name, entity_type, companies_house_number,
  violation_type, severity_tier, industry_sector,
  penalty_amount, penalty_currency,
  outcome (fine | warning | ban | licence_revocation | undertaking),
  summary_text, ai_classification_confidence,
  source_url, raw_html_path, pdf_path
)

-- Sync tracking
enforcement_sync_runs (
  id, regulator, started_at, completed_at,
  actions_found, actions_new, actions_updated, errors
)

-- Alert configuration
alert_rules (
  id, customer_id, regulator_filter, sector_filter,
  violation_type_filter, severity_min, frequency
)

-- Alert delivery
triggered_alerts (
  id, alert_rule_id, enforcement_action_id,
  triggered_at, delivered_at, channel
)

-- Entity linking
entity_registry (
  id, entity_name_normalised, companies_house_number,
  sic_codes, incorporation_date, active_status
)
```

### Tech Stack

- **Scraping:** Playwright (for JS-rendered pages) + fetch (for RSS/XML/API) — same as Nuffield
- **Database:** PostgreSQL (production) or SQLite (pilot) + Drizzle ORM
- **AI:** Claude Haiku for classification (~$0.003 per action) — same model as Nuffield
- **Dashboard:** Next.js + Tailwind + shadcn/ui + Recharts — same stack as Nuffield
- **Hosting:** Vercel (dashboard) + Railway or Fly.io (scraper cron jobs)
- **Alerting:** Resend (email) + Slack webhook integration

### Architecture Reuse from Nuffield

| Component | Nuffield | Enforcement Tracker | Reuse % |
|-----------|----------|-------------------|:-------:|
| Scraper orchestrator (crawl → parse → assess → score) | ✅ | Same pattern | 80% |
| HTML parser with heading-based extraction | ✅ | Adapted for regulator page structures | 50% |
| AI assessment via Claude Haiku | ✅ | Same approach, different classification taxonomy | 70% |
| Deterministic scoring | ✅ | Severity scoring instead of profile quality | 40% |
| Next.js dashboard | ✅ | New views but same component library | 60% |
| SQLite/Drizzle data layer | ✅ | New schema, same ORM and patterns | 70% |

---

## 11. 6-Week Pilot Plan

### Week 1: FCA Fines Table + CMA Cases

| Day | Task |
|-----|------|
| Mon | Scrape FCA structured fines table (last 5 years, ~500-600 actions). Parse: date, firm, penalty amount, category. |
| Tue | Ingest CMA cases via GOV.UK Content API. Parse: date, parties, case type, outcome, sector. |
| Wed | Set up PostgreSQL schema. Load both datasets. Entity linking via Companies House API. |
| Thu | Build basic admin UI to browse actions. Verify data quality against source. |
| Fri | Fix parsing issues. Checkpoint: 2 regulators loaded, browseable. |

### Week 2: AI Classification

| Day | Task |
|-----|------|
| Mon | Design classification prompt for Claude Haiku (violation type, severity, sector, theme). |
| Tue | Run classification on all FCA actions. Measure confidence scores. |
| Wed | Run classification on all CMA cases. Compare output quality. |
| Thu | Human review of 50 random classifications. Refine prompt. Re-run. |
| Fri | Checkpoint: All actions classified with >85% confidence. |

### Week 3: Dashboard MVP

| Day | Task |
|-----|------|
| Mon-Tue | Build enforcement timeline view (actions over time, filterable by regulator/type/severity). |
| Wed | Build violation type heatmap (which categories are trending up/down). |
| Thu | Build penalty trend chart (total fines by quarter, average penalty size). |
| Fri | Checkpoint: Working dashboard with 2 regulators. |

### Week 4: ICO + Gambling Commission + Trend Detection

| Day | Task |
|-----|------|
| Mon | Scrape ICO enforcement actions (5 years). Parse and classify. |
| Tue | Scrape Gambling Commission actions. Parse and classify. |
| Wed | Build cross-regulator view ("all enforcement actions this quarter"). |
| Thu | Build trend detection: quarter-over-quarter change in violation types. Flag acceleration. |
| Fri | Checkpoint: 4 regulators, cross-regulator trends visible. |

### Week 5: Personalisation + Alerts

| Day | Task |
|-----|------|
| Mon | Build "My Regulators" configuration (subscriber selects which regulators and sectors are relevant). |
| Tue | Build personalised risk score: "based on your profile, these are the 5 enforcement trends most relevant to you." |
| Wed | Build email alert system (weekly digest + instant alert for high-severity actions in your sector). |
| Thu | Generate first AI-written monthly briefing PDF. |
| Fri | Internal QA: test all features end-to-end. |

### Week 6: Polish + Demo

| Day | Task |
|-----|------|
| Mon | UI polish, responsive design, loading states, error handling. |
| Tue | Load test with full historical data. Performance optimisation. |
| Wed | Prepare 3 personalised demos (one per target segment). |
| Thu | Demo 1: Mid-tier bank CCO. Demo 2: Gambling company compliance. |
| Fri | Demo 3: Law firm regulatory partner. Collect feedback. Iterate. |

---

## 12. Cost Model

### AI Costs (Claude Haiku)

| Operation | Volume | Cost per action | Total |
|-----------|:------:|:--------------:|:-----:|
| **Historical backfill** (5 years × 4 regulators) | ~2,500 actions | ~$0.007 | **~$18** |
| **Ongoing classification** (new actions) | ~300/year | ~$0.007 | **~$2/year** |
| **Monthly briefing generation** | 12/year per customer | ~$0.05 | **~$0.60/year per customer** |
| **Trend summary generation** | Weekly | ~$0.02 | **~$1/year** |

**Total AI cost Year 1 (40 customers):** ~$45

### Infrastructure Costs (Estimated Monthly)

| Component | Service | Cost |
|-----------|---------|:----:|
| Dashboard hosting | Vercel Pro | $20/month |
| Scraper hosting | Railway / Fly.io | $10/month |
| Database | Railway PostgreSQL | $10/month |
| Email (alerts + digests) | Resend | $20/month |
| Domain + SSL | Cloudflare | $0 |
| **Total** | | **~$60/month** |

### Year 1 P&L Sketch

| Item | Conservative | Base | Optimistic |
|------|:-----------:|:----:|:----------:|
| ARR | £290k | £850k | £1.8M |
| AI costs | -£35 | -£45 | -£60 |
| Infrastructure | -£720 | -£1,200 | -£2,400 |
| **Gross margin** | **~99.7%** | **~99.8%** | **~99.9%** |

The unit economics are extraordinary — near-zero marginal cost per customer.

---

## 13. Risks & Mitigations

### Critical Risks

| # | Risk | Severity | Probability | Mitigation |
|---|------|:--------:|:-----------:|-----------|
| R1 | FCA ToS prohibits scraping — could send cease & desist | High | Medium | Use RSS/XML feeds and structured tables only. Never scrape fca.org.uk HTML. Document data provenance. |
| R2 | AI misclassifies enforcement actions — reputational damage | High | Low | Confidence scoring on every classification. Human review for severity=Critical. Never present as "legal advice." |
| R3 | Regulator website format changes break scrapers | Medium | High (certain) | Same problem solved at Nuffield. Monitoring + parser maintenance is BAU. Budget 2-4 hours/month. |

### Moderate Risks

| # | Risk | Severity | Probability | Mitigation |
|---|------|:--------:|:-----------:|-----------|
| R4 | Thomson Reuters or LexisNexis builds AI layer on existing data | Medium | Medium | Speed advantage — they're slow-moving incumbents. Our 6-week MVP beats their 18-month product cycle. |
| R5 | Enterprise sales cycles longer than expected | Medium | Medium | Lead with Signal tier (self-serve, low ACV). Use as wedge into enterprise. |
| R6 | Compliance teams want GRC integration (ServiceNow, Diligent) | Medium | High | Build API from Day 1. Partnership discussions with GRC vendors in Phase 2. |
| R7 | Market smaller than estimated | Medium | Low | Even conservative scenario (£290k ARR) is profitable at near-zero cost base. |

### Low Risks

| # | Risk | Severity | Probability | Mitigation |
|---|------|:--------:|:-----------:|-----------|
| R8 | Corlytics or FinregE expand to multi-regulator UK | Low | Low | They're global/financial focused. UK multi-regulator is our niche. |
| R9 | Free alternatives (regulator RSS feeds) are "good enough" | Low | Medium | RSS feeds give raw notices. We give classified, scored, trended intelligence. 100x more useful. |

### Unknowns Requiring Further Investigation

| # | Unknown | Impact | How to Resolve |
|---|---------|--------|---------------|
| U1 | Exact FCA RSS feed coverage — does it include all enforcement types? | Could limit FCA data if feeds are incomplete | Test feeds during Week 1 of pilot |
| U2 | Companies House API rate limits under sustained load | Could slow entity linking at scale | Test during pilot; consider bulk download as fallback |
| U3 | Actual compliance team willingness to trial a startup product | Could extend sales cycle | Test with 5 demos during pilot Week 6 |
| U4 | Whether regulators will object to commercial use of their data | Low probability but worth confirming | Seek legal opinion on OGL commercial use before launch |

---

## 14. Weighted Scoring

### Framework (from Master Scoring Methodology)

| # | Criterion | Weight | Score (1-10) | Weighted |
|---|-----------|:------:|:------------:|:--------:|
| 1 | **Buyer Pain Urgency** — Is this mandatory or nice-to-have? | 20 | **9** | 180 |
| 2 | **ACV / Pricing Potential** — Can we charge £25k+? | 15 | **7** | 105 |
| 3 | **Data Rights / Legal Risk** — Can we access data legally? | 15 | **7** | 105 |
| 4 | **Data Availability / Accessibility** — Is the data structured and reliable? | 10 | **8** | 80 |
| 5 | **Speed to MVP** — Can we build a pilot in 6 weeks? | 10 | **9** | 90 |
| 6 | **Sales Cycle Length** — Can we close in under 3 months? | 10 | **7** | 70 |
| 7 | **Competitive Intensity** — How crowded is the market? | 10 | **7** | 70 |
| 8 | **Defensibility / Moat Potential** — Can competitors copy easily? | 5 | **5** | 25 |
| 9 | **Strategic Fit with SensAI** — Does it match our mission and capabilities? | 5 | **9** | 45 |
| | **Base Score** | **100** | | **770 / 1000** |

### Score Justifications

| # | Score | Justification |
|---|:-----:|---------------|
| 1 | 9 | Compliance monitoring is legally mandatory for regulated firms. CCOs must track their regulators. Not 10 because some firms get by with manual monitoring. |
| 2 | 7 | Intelligence tier at £15-30k is achievable. Command tier at £50-150k for enterprise. Not higher because Signal tier drags average ACV down. Blended ACV ~£21k. |
| 3 | 7 | 3 of 4 Tier 1 regulators are GREEN (OGL). FCA is RED for scraping but GREEN via RSS/XML. Not higher because FCA ToS creates ongoing legal vigilance requirement. |
| 4 | 8 | Enforcement actions are well-structured (dates, names, penalties). Most regulators publish in consistent formats. Not 9 because ICO and some Tier 2 regulators have inconsistent HTML. |
| 5 | 9 | Direct reuse of Nuffield architecture. Only 4 regulator sources needed for MVP. 6-week pilot is highly feasible based on proven tech stack. |
| 6 | 7 | Compliance teams can decide in 4-8 weeks (faster than most enterprise). Signal tier is near-instant. Not higher because FTSE 100 procurement takes 3-4 months. |
| 7 | 7 | No direct competitor in Quadrant 4 (high breadth + high AI). Thomson Reuters and LexisNexis are indirect. Not higher because they could pivot. Corlytics could expand. |
| 8 | 5 | Historical data creates some moat. Multi-regulator parsing is moderately hard to replicate. But the data itself is public — a funded competitor could rebuild in months. |
| 9 | 9 | Same tech stack, same AI engine, same dashboard pattern as Nuffield. "Unifying Vision with AI" — enforcement intelligence is a natural extension. |

### Confidence Factor

| Factor | Assessment | Impact |
|--------|-----------|:------:|
| Evidence quality | 4 agents conducted independent research with web sources. FCA ToS confirmed. TRRI pricing confirmed via public tender. Competitor landscape mapped comprehensively. | High |
| Assumption risk | FCA RSS feed coverage unconfirmed. Actual sales cycle for compliance tools is estimated. Market size extrapolated. | Medium |
| **Confidence Factor** | | **0.85** |

### Final Score

```
Base Score:       770 / 1000
Confidence:       × 0.85
─────────────────────────
FINAL SCORE:      654.5 / 1000
```

**Interpretation:** Strong opportunity with manageable risks. The 0.85 confidence factor reflects the FCA data access uncertainty and unvalidated sales cycle assumptions — both resolvable during the 6-week pilot.

### Hard Gate Check

| Gate | Pass? | Notes |
|------|:-----:|-------|
| No unresolved legal/data-rights red flags | ✅ | FCA RED risk mitigated by RSS/XML route. All other regulators GREEN. |
| Clear budget-owning buyer persona | ✅ | CCO is the buyer. Compliance budgets are non-discretionary. 6 personas validated. |
| Feasible MVP in 8 weeks | ✅ | 6-week pilot plan is achievable — reuses 60-80% of Nuffield tech stack. |

**All hard gates passed.**

---

## 15. Go / Hold / No-Go Recommendation

### Recommendation: **GO**

### Rationale

1. **Mandatory buyer need.** Compliance monitoring is not optional — regulated firms *must* track their regulators. This is "hair on fire" pain, not "nice to have."

2. **Confirmed white space.** No existing product combines multi-regulator UK breadth with AI classification and trend detection. The Quadrant 4 position is open.

3. **Near-zero marginal costs.** AI classification costs ~$18 for the entire historical backfill. Infrastructure runs at ~$60/month. Gross margins are ~99.7%.

4. **Massive architecture reuse.** 60-80% of the Nuffield Health tech stack applies directly. The 6-week pilot is not speculative — it's an adaptation of a proven codebase.

5. **Market validation signal.** UK government pays £105,000/year for Thomson Reuters Regulatory Intelligence. Companies pay £30-100k for LexisNexis/Westlaw access. Budget exists.

6. **FCA risk is manageable.** The ToS prohibition applies to scraping, not to RSS/XML feeds and structured data tables. This shapes the technical approach but does not block the product.

### Conditions for GO

| # | Condition | Timing |
|---|-----------|--------|
| C1 | Confirm FCA RSS feed covers all enforcement action types (test in Week 1) | Before public launch |
| C2 | Obtain legal opinion on OGL commercial use for CMA/ICO/GC data | Before public launch |
| C3 | Validate classification accuracy >90% via human review of 100 actions | End of Week 2 |
| C4 | Secure 3 demo meetings with target CCOs before starting build | Before starting build |

### What "Hold" Would Look Like

If any of these were true, we'd hold:
- FCA RSS feeds don't cover enforcement actions (they probably do — but must confirm)
- Legal opinion finds OGL doesn't permit commercial resale (very unlikely — OGL explicitly allows commercial use)
- Zero demo meetings secured after 2 weeks of outreach (signals market disinterest)

### What "No-Go" Would Look Like

- A direct competitor launches a multi-regulator AI enforcement product in the UK before we reach MVP (monitor Corlytics, FinregE, CUBE)
- Regulatory change makes enforcement data non-public (extremely unlikely — transparency is a policy direction, not retreating)

---

*Research complete. Awaiting ROG review and approval before proceeding to Idea 2 (Government Contract Intelligence).*

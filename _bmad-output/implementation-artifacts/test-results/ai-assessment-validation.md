# AI Assessment (Haiku) Validation Report

**Date:** 2026-02-28
**Tested by:** ROG
**Model:** claude-haiku-4-5-20251001
**Status:** Manual validation — 4 profiles tested, all passed

---

## Purpose

The scraper pipeline has two layers:
- **Layer 1 (Deterministic):** HTML parser extracts structured fields (name, specialties, treatments, insurers, etc.)
- **Layer 2 (AI Assessor):** Claude Haiku reads the profile text and produces subjective quality judgements that a parser cannot make

Layer 2 is currently disabled (`--skip-assess`) while Layer 1 is validated in the 200-profile stress test. This report validates that the AI assessment works correctly and produces sensible, consistent output when enabled.

---

## What Haiku Assesses

| Output Field | Type | What It Evaluates |
|---|---|---|
| `plain_english_score` | 1-5 integer | Is the bio readable by patients or full of medical jargon? |
| `bio_depth` | substantive/adequate/thin/missing | Does the bio contain meaningful detail about experience and approach? |
| `treatment_specificity_score` | highly_specific/moderately_specific/generic/not_applicable | Are treatments named specifically or described vaguely? |
| `declaration_substantive` | boolean | Does the declaration contain real financial interests or just boilerplate? |
| `inferred_sub_specialties` | string[] | Sub-specialties implied by the full profile text (beyond explicit headings) |
| `clinical_interests` | string[] | Clinical interests extracted/inferred from free text |
| `personal_interests` | string or null | Personal hobbies/interests if mentioned in bio |
| `languages` | string[] | Languages mentioned anywhere in profile |
| `overall_quality_notes` | string | Free-text summary including any anomalies detected |

### Scoring Impact

Haiku output directly affects **25 out of 100 points** in the completeness score:
- `plain_english_score` >= 4 = **10 pts** | = 3 = **5 pts** | <= 2 = **0 pts**
- `bio_depth` = substantive = **15 pts** | adequate = **10 pts** | thin/missing = **0 pts**

Without AI assessment, no profile can reach Gold tier (requires score >= 80 AND bio_depth = substantive).

---

## Test Results

### Profile 1: Dr Sam Firoozi (Cardiology)

| Field | Result |
|---|---|
| plain_english_score | **3** — "Mixed approach with medical terminology (MRCP, TAVI, PCI) alongside accessible language" |
| bio_depth | **substantive** — "Detailed background including education, timeline of training, key qualifications, fellowship awards, and current clinical role" |
| treatment_specificity | **highly_specific** — Named procedures (Coronary Angioplasty/PCI, TAVI, peripheral arterial stenting) |
| declaration_substantive | **false** — Boilerplate "no interests" |
| inferred_sub_specialties | Interventional Cardiology, Structural Cardiac Intervention, Coronary Intervention, Valvular Heart Disease, Heart Failure Management |
| personal_interests | null |
| QA observations | Caught "Browser doesn't support frames" artifact in About text (iframe rendering leakage) |

### Profile 2: Mr Khitish Mohanty (Orthopaedic / Knee Surgery)

| Field | Result |
|---|---|
| plain_english_score | **3** — "Mix of medical terminology (joint replacement, fracture fixation, sacroiliac joint) and accessible language" |
| bio_depth | **substantive** — "17+ years experience, specific training pathway, regional expertise, research contributions, teaching roles" |
| treatment_specificity | **highly_specific** — Named procedures including robotic-assisted surgery (MAKO) |
| declaration_substantive | **false** — Boilerplate |
| inferred_sub_specialties | Hip and knee arthroplasty, Sacroiliac joint disorders, Pelvic trauma, Orthopaedic trauma, Robotic-assisted joint surgery |
| personal_interests | **"Golf, running, gardening"** — extracted from bio text (parser cannot do this) |
| QA observations | Caught typo "Orthopeedic" in memberships (should be "Orthopaedic"). Caught "Consutlant" typo in Other posts held |

### Profile 3: Mr Edward Saxby (Ophthalmology)

| Field | Result |
|---|---|
| plain_english_score | **4** — "Mostly accessible language with minimal jargon. Medical terms explained contextually" |
| bio_depth | **substantive** — "Detailed background including training institutions (Bristol, Edinburgh, Cambridge), specialty progression" |
| treatment_specificity | **highly_specific** — 9 named procedures with specific diagnoses/conditions |
| declaration_substantive | **false** — Boilerplate |
| inferred_sub_specialties | Oculoplastic surgery, Lacrimal surgery, Orbital surgery, Eyelid surgery, Cosmetic ophthalmic surgery, Reconstructive eye surgery |
| personal_interests | "Medical education; runs national and international courses in eyelid surgery" |
| QA observations | Noted international teaching activity, external website link present |

### Profile 4: Miss Caroline Cheadle (Orthopaedic / Hand & Wrist)

| Field | Result |
|---|---|
| plain_english_score | **3** — "Training narrative is clear, but areas of interest section uses considerable surgical jargon" |
| bio_depth | **substantive** — "Detailed training pathway from medical school through fellowship, specific institutional affiliations" |
| treatment_specificity | **highly_specific** — Named procedures (carpal tunnel release, trapeziectomy, Dupuytren's fasciectomy) |
| declaration_substantive | **false** — Boilerplate |
| inferred_sub_specialties | Hand and Wrist Surgery, Trauma Surgery, Peripheral Nerve Surgery, Joint Replacement/Arthroplasty, Arthroscopic Surgery |
| personal_interests | null |
| QA observations | "Profile would benefit from plain-language explanations of key procedures for patient accessibility" |

---

## Summary of Findings

### What's Working Well

1. **Consistent, sensible scoring** — plain_english_score correctly differentiates profiles (Saxby's patient-friendly language scored 4, the jargon-heavy ones scored 3)
2. **Sub-specialty inference** — Haiku extracts 5-6 sub-specialties per profile from the full text, well beyond what the explicit Specialties heading provides
3. **Personal interests extraction** — picks up hobbies embedded in bio text (e.g. "golf, running, gardening") that the deterministic parser cannot identify
4. **Declaration analysis** — correctly identified all 4 as boilerplate. We have prior evidence (Prof Kastner, Round 6) that it correctly flags substantive declarations too
5. **QA observations** — catches typos ("Orthopeedic", "Consutlant"), rendering artifacts ("Browser doesn't support frames"), and makes actionable quality recommendations
6. **Zod validation** — all 4 responses passed strict JSON schema validation on the first attempt (no retries needed)
7. **Response time** — each call completed in ~3-5 seconds

### Issues / Action Items

| # | Issue | Severity | Action |
|---|---|---|---|
| 1 | "Browser doesn't support frames" text leaking into About section on profiles with booking iframe | Bug (parser) | Parser should strip this string from `about_text` before sending to AI and before DB persistence. Likely present on many profiles. |
| 2 | CMS typos (e.g. "Orthopeedic", "Consutlant") are faithfully preserved in raw data | Info | By design — we capture verbatim. Haiku flags these in `overall_quality_notes` for QA review. No parser change needed. |
| 3 | `personal_interests` classified "medical education" as personal rather than professional (Saxby) | Minor | Borderline case. Consider adding `professional_interests` guidance to the Haiku prompt for clearer separation. Low priority. |
| 4 | No languages detected on any of the 4 profiles | Expected | None of these profiles had a Languages section. Parser already handles language extraction when present; Haiku serves as fallback. |

### Cost Projection

- 4 profiles tested: ~$0.001 total
- Full run (3,800 profiles): estimated **$1-2 total**
- Model: claude-haiku-4-5-20251001 (cheapest Claude model)

---

## Recommendation

AI assessment is working correctly and ready to enable. Suggested next steps:

1. ~~Fix the "Browser doesn't support frames" parser leak (Issue #1 above)~~ **DONE** — BUG-015 fixed, `stripRenderingArtifacts()` added to parser
2. Complete the 200-profile stress test (Layer 1 validation)
3. Enable AI assessment on the next run by removing `--skip-assess`
4. Spot-check 10-15 AI-assessed profiles for reviewer agreement (target: 90% per spec)

---

## Post-Report Fixes Applied (Quick Spec v1.8)

All issues from this validation and the PM review have been addressed:

- **BUG-015 fixed** — `stripRenderingArtifacts()` strips iframe noscript text from about_text, overview_text, related_experience_text
- **Evidence fields persisted** — All AI reason fields (plain_english_reason, bio_depth_reason, treatment_specificity_reason, qualifications_completeness_reason, ai_quality_notes) now saved to DB
- **qualifications_completeness added** — New enum field in Zod schema + DB column + system prompt
- **professional_interests added** — New nullable string in Zod schema + DB column + system prompt with classification guidance (clinical vs professional vs personal)
- **13 new tests** — 5 for assess.test.ts (schema validation + NULL_ASSESSMENT), 8 for parse.test.ts (BUG-015 regression). Total: 174

# Feature Spec: Scoring Configuration Controls
**Version:** 0.1
**Date:** 2026-02-28
**Owner:** ROG
**Status:** Approved for implementation

---

## 1. Problem
Scoring is currently hardcoded. Users cannot see or tune how points are allocated (for example, photo = 10 points). This prevents controlled experimentation and creates friction when business priorities change.

## 2. Goal
Add a **Configuration** area where users can:
1. See all score dimensions and definitions
2. Adjust score weights
3. Save and persist scoring rules
4. Keep scoring on a stable **100-point scale**

## 3. Scope
### In Scope
- New left-nav menu item: `Configuration`
- New page: `/configuration`
- Editable weight model for core scoring dimensions
- Tier threshold editing (`Gold`, `Silver`, `Bronze`)
- Persistent config storage
- Scoring engine reads active configuration for future scoring
- Tooltips for dimension definitions and scoring behavior

### Out of Scope (Phase 2)
- Historical re-score of completed runs
- Per-hospital/per-specialty custom scoring profiles
- Audit UI for config change history
- Role-based access controls

## 4. Weight Model
### 4.1 Editable Dimensions (raw weights)
- Profile photo
- Biography depth (max points for substantive)
- Treatments listed
- Qualifications
- Specialty evidence
- Insurers listed
- Consultation times
- Plain English score (max points)
- Booking availability (max points)
- Practising since
- Memberships

### 4.2 Derived Rules (shown in UI)
- Bio `adequate` earns `2/3` of Bio max
- Plain English score `3` earns `1/2` of Plain English max
- Booking `bookable_no_slots` earns `1/2` of Booking max

### 4.3 Normalization Rule
- Users edit **raw weights**
- System auto-normalizes to effective points summing to **100**
- Effective points are used in scoring

Formula:
`effective_weight_i = (raw_weight_i / sum(raw_weights)) * 100`

## 5. Tier Rules
- Tier thresholds remain configurable
- Defaults:
  - Gold >= 80
  - Silver >= 60
  - Bronze >= 40
- Validation:
  - `Gold > Silver > Bronze >= 0`
  - Prefer max 100 (warn if exceeded)

## 6. Data Storage
Persist in JSON file:
- Path: `data/scoring-config.json`
- Contents:
  - version
  - updatedAt
  - updatedBy
  - normalization metadata
  - raw weights
  - effective weights
  - tier thresholds

If file is missing/invalid, system auto-falls back to defaults.

## 7. UX Requirements
### 7.1 Navigation
- Add `Configuration` nav item in left sidebar

### 7.2 Configuration Page
- Weight table with:
  - Dimension name
  - Tooltip definition
  - Raw weight input
  - Effective points preview
- Tier threshold editor
- Live totals:
  - Raw total
  - Effective total (always 100)
- Actions:
  - Save Configuration
  - Reset to Defaults
- Inline validation + save status feedback

## 8. API Requirements
Endpoint: `/api/configuration/scoring`
- `GET`: return active configuration
- `POST`: validate, normalize, persist, return saved config

## 9. Scoring Engine Integration
- `scoreConsultant` uses active persisted config
- If no config found, use defaults
- Applies to future scrape/scoring operations

## 10. Acceptance Criteria
1. `Configuration` appears in left nav and opens `/configuration`
2. User can edit raw weights and save
3. Saved config persists after reload/restart
4. Effective weights always total 100
5. Tier threshold validation blocks invalid combinations
6. Scoring module reads active config
7. Tooltips explain all editable dimensions and derived rules

## 11. Risks and Mitigations
- Risk: Extreme weights can skew quality signals
  - Mitigation: show live preview + warnings when one dimension dominates
- Risk: Inconsistent interpretation across historical runs
  - Mitigation: treat config changes as forward-only for this phase

## 12. Future Enhancements
- Config version history + rollback UI
- “What changed” impact simulator on existing run
- Locking/permissions for configuration edits

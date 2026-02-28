// Scrape status progression per (run_id, slug)
export type ScrapeStatus =
  | "pending"
  | "crawl_done"
  | "parse_done"
  | "booking_done"
  | "assess_done"
  | "complete"
  | "error";

// Pipeline stage identifiers for logging and error tracking
export type PipelineStage = "crawl" | "parse" | "booking_api" | "ai_assessment" | "score";

// Profile status derived from HTTP response
export type ProfileStatus = "active" | "deleted" | "error";

// Booking state classification
export type BookingState = "not_bookable" | "bookable_no_slots" | "bookable_with_slots";

// AI-assessed bio depth
export type BioDepth = "substantive" | "adequate" | "thin" | "missing";

// AI-assessed treatment specificity
export type TreatmentSpecificity = "highly_specific" | "moderately_specific" | "generic" | "not_applicable";

// Quality tier classification
export type QualityTier = "Gold" | "Silver" | "Bronze" | "Incomplete";

// Flag severity levels
export type FlagSeverity = "fail" | "warn" | "info";

// Flag object attached to each consultant record
export interface Flag {
  code: string;
  severity: FlagSeverity;
  message: string;
}

// Run status
export type RunStatus = "running" | "completed" | "failed";

// Extraction confidence level
export type Confidence = "high" | "medium" | "low";

// News item in "In the news" section
export interface NewsItem {
  title: string;
  url: string;
}

// Dashboard filter parameters
export interface ConsultantFilters {
  run_id?: string;
  hospital?: string;
  specialty?: string;
  quality_tier?: QualityTier;
  booking_state?: BookingState;
  flag_code?: string;
  search?: string;
  page?: number;
  per_page?: number;
  bio_depth?: BioDepth;
  has_photo?: boolean;
  has_fail_flags?: boolean;
  has_warn_flags?: boolean;
  bio_needs_expansion?: boolean;
  missing_insurers?: boolean;
  missing_consultation_times?: boolean;
  missing_qualifications?: boolean;
  missing_memberships?: boolean;
  score_min?: number;
  score_max?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

// Score dimension definition for recomputing breakdown
export interface ScoreDimension {
  key: string;
  label: string;
  maxPoints: number;
  earned: number;
}

// ============================================================
// Profile Rewrite Engine Types
// ============================================================

// Rewrite mode — full profile or single element
export type RewriteMode = "full" | "element";

// Rewrite status lifecycle
export type RewriteStatus = "draft" | "accepted" | "rejected";

// Rewritable element keys (spec §13)
export type RewritableElementKey =
  | "bio"
  | "treatments"
  | "qualifications"
  | "specialty_sub"
  | "memberships"
  | "practising_since"
  | "clinical_interests"
  | "personal_interests"
  | "photo";

// Research pipeline stages (spec §4.1)
export type ResearchStage =
  | "searching"
  | "fetching"
  | "extracting"
  | "corroborating"
  | "generating"
  | "scoring"
  | "storing"
  | "complete"
  | "error";

// Extracted fact from a research source
export interface ExtractedFact {
  element: string;
  fact: string;
  confidence: "high" | "medium" | "low";
}

// Rewrite progress for polling
export interface RewriteProgress {
  current_stage: ResearchStage;
  sources_found: number;
  facts_extracted: number;
}

// Element rewrite result for API response
export interface ElementRewriteResult {
  status: ResearchStage;
  rewritten_content: string | null;
  original_content: string | null;
  sources: { source_id: string; url: string; title: string | null; corroborated: boolean }[];
  projected_delta: number | null;
  seo_score_before: number | null;
  seo_score_after: number | null;
}

// Full rewrite API response
export interface RewriteResponse {
  rewrite_id: string;
  status: ResearchStage;
  progress: RewriteProgress | null;
  elements: Partial<Record<RewritableElementKey, ElementRewriteResult>>;
  projected_total_score: number | null;
  projected_tier: QualityTier | null;
}

// Benchmark profile for the exemplar bar
export interface BenchmarkProfile {
  slug: string;
  consultant_name: string;
  specialty_primary: string[];
  hospital_name_primary: string | null;
  profile_completeness_score: number;
  quality_tier: QualityTier;
  has_photo: boolean | null;
  bio_depth: BioDepth | null;
  treatments_count: number;
  qualifications_present: boolean;
  memberships_count: number;
  practising_since: number | null;
}

// Search API usage tracking
export interface SearchUsage {
  month: string; // YYYY-MM
  queries_used: number;
  last_query_at: string | null;
}

// SEO score breakdown (spec §10.1)
export interface SeoScoreBreakdown {
  keyword_richness: number;    // 0-30
  content_length: number;      // 0-20
  patient_language: number;    // 0-20
  structured_completeness: number; // 0-20
  location_signals: number;    // 0-10
  total: number;               // 0-100
}

// Superlative blocklist for validation (spec §11.3)
export const SUPERLATIVE_BLOCKLIST = [
  "best", "leading", "top", "renowned", "world-class",
  "unparalleled", "premier", "foremost", "preeminent",
  "number one", "no. 1", "finest",
] as const;

// Filter counts for sidebar badges
export interface FilterCounts {
  tiers: Record<string, number>;
  booking_states: Record<string, number>;
  hospitals: { name: string; count: number }[];
  specialties: { name: string; count: number }[];
  bio_depths: Record<string, number>;
  photo: { has: number; missing: number };
  flags: { fail: number; warn: number };
  action_gaps: {
    bio_needs_expansion: number;
    missing_insurers: number;
    missing_consultation_times: number;
    missing_qualifications: number;
    missing_memberships: number;
  };
}

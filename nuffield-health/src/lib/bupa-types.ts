import type { QualityTier } from "./types";

// Match method used to link Nuffield consultant to BUPA profile
export type MatchMethod = "sitemap" | "name_search" | "gmc_match";

// Confidence level for consultant matching
export type MatchConfidence = "high" | "medium" | "low";

// BUPA scrape pipeline status
export type BupaScrapeStatus =
  | "pending"
  | "crawl_done"
  | "parse_done"
  | "assess_done"
  | "complete"
  | "error";

// BUPA run status
export type BupaRunStatus = "running" | "completed" | "failed";

export interface BupaSectionData {
  heading: string;
  values: string[];
}

// Result from parsing a BUPA profile page
export interface BupaParseResult {
  bupa_id: string;
  bupa_slug: string;
  consultant_name: string | null;
  registration_number: string | null;
  profile_url: string;
  has_photo: boolean;
  about_text: string | null;
  specialty_primary: string[];
  specialty_sub: string[];
  treatments: string[];
  qualifications_credentials: string | null;
  memberships: string[];
  clinical_interests: string[];
  languages: string[];
  hospital_affiliations: string[];
  fee_assured: boolean;
  contact_phone_numbers: string[];
  contact_email_addresses: string[];
  website_urls: string[];
  accreditation_badges: string[];
  source_sections: Record<string, BupaSectionData>;
  unmapped_section_keys: string[];
}

// Candidate from sitemap or search for matching
export interface BupaCandidate {
  bupa_id: string;
  bupa_slug: string;
  profile_url: string;
  name_from_url: string;
}

// Match result linking Nuffield to BUPA
export interface ConsultantMatch {
  nuffield_slug: string;
  bupa_id: string;
  match_method: MatchMethod;
  match_confidence: MatchConfidence;
  registration_number: string | null;
}

// Per-dimension comparison result
export interface DimensionComparison {
  dimension: string;
  label: string;
  nuffield_value: string | number | boolean | null;
  bupa_value: string | number | boolean | null;
  winner: "nuffield" | "bupa" | "tie" | "incomparable";
}

// Per-consultant comparison
export interface ConsultantComparison {
  nuffield_slug: string;
  bupa_id: string | null;
  match_confidence: MatchConfidence | null;
  nuffield_name: string | null;
  bupa_name: string | null;
  nuffield_score: number | null;
  bupa_score: number | null;
  nuffield_adjusted_score: number | null;
  bupa_adjusted_score: number | null;
  nuffield_tier: QualityTier | null;
  bupa_tier: QualityTier | null;
  dimensions: DimensionComparison[];
  bupa_profile_url: string | null;
}

// Aggregate comparison stats
export interface AggregateComparison {
  // Match stats
  total_nuffield: number;
  matched_count: number;
  nuffield_only_count: number;
  match_rate: number;

  // Score comparison (matched only)
  nuffield_avg_score: number | null;
  bupa_avg_score: number | null;
  nuffield_avg_adjusted: number | null;
  bupa_avg_adjusted: number | null;

  // Tier distributions
  nuffield_tiers: Record<QualityTier, number>;
  bupa_tiers: Record<QualityTier, number>;

  // Win/loss
  bupa_better_count: number;
  nuffield_better_count: number;
  tie_count: number;

  // Per-dimension breakdown
  dimension_wins: {
    dimension: string;
    label: string;
    bupa_wins: number;
    nuffield_wins: number;
    ties: number;
  }[];
}

// Adjusted score result (booking dimension excluded, normalized to 0-100)
export interface AdjustedScore {
  raw_score: number;
  adjusted_score: number;
  booking_points_excluded: number;
}

// Top gap entry for the dashboard table
export interface TopGap {
  nuffield_slug: string;
  consultant_name: string | null;
  specialty_primary: string[];
  nuffield_adjusted: number;
  bupa_adjusted: number;
  gap: number;
  bupa_profile_url: string | null;
}

// Full matched pair for the all-consultants comparison table
export interface MatchedPair {
  nuffield_slug: string;
  consultant_name: string | null;
  specialty_primary: string[];
  nuffield_adjusted: number;
  nuffield_tier: QualityTier | null;
  bupa_adjusted: number;
  bupa_tier: QualityTier | null;
  delta: number; // nuffield - bupa (positive = nuffield better)
  winner: "nuffield" | "bupa" | "tie";
  bupa_profile_url: string | null;
}

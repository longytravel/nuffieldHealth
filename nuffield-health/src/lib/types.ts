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
}

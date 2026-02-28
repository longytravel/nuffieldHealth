// Load .env file if present (before reading env vars)
import { existsSync } from "fs";
if (existsSync(".env")) process.loadEnvFile(".env");

// Environment variables with defaults
export const APIM_SUBSCRIPTION_KEY = process.env.APIM_SUBSCRIPTION_KEY ?? "";
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
export const DATABASE_PATH = process.env.DATABASE_PATH ?? "data/nuffield.db";
export const HTML_CACHE_PATH = process.env.HTML_CACHE_PATH ?? "data/html-cache";
export const SCRAPE_DELAY_MS = Number(process.env.SCRAPE_DELAY_MS ?? 1500);
export const API_DELAY_MS = Number(process.env.API_DELAY_MS ?? 500);
export const BOOKING_API_CONCURRENCY = Number(process.env.BOOKING_API_CONCURRENCY ?? 3);
export const DATA_RETENTION_DAYS = Number(process.env.DATA_RETENTION_DAYS ?? 90);
export const EXPORT_INCLUDE_CONTACT_DATA = process.env.EXPORT_INCLUDE_CONTACT_DATA === "true";

// Scoring weights — exact values from architecture.md §Scoring Specification
export const SCORE_WEIGHTS = {
  has_photo: 10,
  bio_depth_substantive: 15,
  bio_depth_adequate: 10,
  treatments_non_empty: 10,
  qualifications_non_null: 10,
  specialty_primary_non_empty: 10,
  insurers_non_empty: 8,
  consultation_times_non_empty: 7,
  plain_english_4_plus: 10,
  plain_english_3: 5,
  booking_with_slots: 10,
  booking_no_slots: 5,
  practising_since_non_null: 5,
  memberships_non_empty: 5,
} as const;

// Tier thresholds — exact values from architecture.md
export const TIER_THRESHOLDS = {
  gold: { minScore: 80, mandatory: ["has_photo", "bio_depth_substantive", "specialty_non_empty"] },
  silver: { minScore: 60, mandatory: ["has_photo", "specialty_non_empty"] },
  bronze: { minScore: 40, mandatory: ["specialty_non_empty"] },
  incomplete: { minScore: 0, mandatory: [] },
} as const;

// Specialties where missing treatments section is not penalised
export const NON_PROCEDURAL_SPECIALTIES = [
  "Psychiatry",
  "Psychology",
  "Pain Management",
  "Clinical Neurophysiology",
  "Counselling",
  "Psychotherapy",
  "Clinical Psychology",
  "Neuropsychology",
] as const;

// Retry constants — bounded exponential backoff with jitter
export const MAX_RETRIES_429 = 3;
export const MAX_RETRIES_503 = 2;
export const MAX_RETRIES_5XX = 1;
export const MAX_RETRIES_TIMEOUT = 2;

export const BASE_DELAY_429_MS = 10_000;
export const BASE_DELAY_503_MS = 5_000;
export const BASE_DELAY_5XX_MS = 5_000;
export const BASE_DELAY_TIMEOUT_MS = 5_000;

// Jitter formula: delay = baseDelay * (2 ** attempt) * (0.8 + Math.random() * 0.4)
export function calculateRetryDelay(baseDelay: number, attempt: number): number {
  return baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
}

import { z } from "zod/v4";

// Flag schema
const flagSchema = z.object({
  code: z.string(),
  severity: z.enum(["fail", "warn", "info"]),
  message: z.string(),
});

// News item schema
const newsItemSchema = z.object({
  title: z.string(),
  url: z.string(),
});

// Full consultant record schema for validation before DB insert
export const consultantSchema = z.object({
  // Key fields
  run_id: z.string().uuid(),
  slug: z.string().min(1),

  // 3.1 Identity and Crawl Fields
  consultant_name: z.string().nullable(),
  consultant_title_prefix: z.string().nullable(),
  profile_url: z.string().nullable(),
  profile_slug: z.string().min(1),
  http_status: z.number().int().nullable(),
  profile_status: z.enum(["active", "deleted", "error"]),
  registration_number: z.string().nullable(),
  gmc_code_for_booking: z.string().nullable(),
  hospital_name_primary: z.string().nullable(),
  hospital_code_primary: z.string().nullable(),

  // 3.2 Profile Quality Fields
  has_photo: z.boolean().nullable(),
  specialty_primary: z.array(z.string()),
  specialty_sub: z.array(z.string()),
  plain_english_score: z.number().int().min(1).max(5).nullable(),
  bio_depth: z.enum(["substantive", "adequate", "thin", "missing"]).nullable(),
  treatments: z.array(z.string()),
  treatments_excluded: z.array(z.string()),
  treatment_specificity_score: z
    .enum(["highly_specific", "moderately_specific", "generic", "not_applicable"])
    .nullable(),
  insurers: z.array(z.string()),
  insurer_count: z.number().int().nullable(),
  qualifications_credentials: z.string().nullable(),
  practising_since: z.number().int().nullable(),
  memberships: z.array(z.string()),
  clinical_interests: z.array(z.string()),
  personal_interests: z.string().nullable(),
  languages: z.array(z.string()),
  consultation_times_raw: z.array(z.string()),
  declaration: z.array(z.string()).nullable(),
  in_the_news: z.array(newsItemSchema).nullable(),
  professional_roles: z.string().nullable(),
  patient_age_restriction: z.string().nullable(),
  patient_age_restriction_min: z.number().int().nullable(),
  patient_age_restriction_max: z.number().int().nullable(),
  external_website: z.string().nullable(),
  cqc_rating: z.string().nullable(),
  booking_caveat: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_mobile: z.string().nullable(),
  contact_email: z.string().nullable(),
  hospital_is_nuffield: z.boolean().nullable(),
  hospital_nuffield_at_nhs: z.boolean().nullable(),
  declaration_substantive: z.boolean().nullable(),

  // 3.3 Booking Fields
  booking_state: z.enum(["not_bookable", "bookable_no_slots", "bookable_with_slots"]).nullable(),
  online_bookable: z.boolean().nullable(),
  available_slots_next_28_days: z.number().int().nullable(),
  next_available_date: z.string().nullable(),
  days_to_first_available: z.number().int().nullable(),
  consultation_price: z.number().nullable(),

  // 3.4 Aggregate Fields
  profile_completeness_score: z.number().min(0).max(100).nullable(),
  quality_tier: z.enum(["Gold", "Silver", "Bronze", "Incomplete"]).nullable(),
  flags: z.array(flagSchema),

  // Pipeline Fields
  scrape_status: z.enum([
    "pending",
    "crawl_done",
    "parse_done",
    "booking_done",
    "assess_done",
    "complete",
    "error",
  ]),
  scrape_error: z.string().nullable(),
  manually_reviewed: z.boolean(),
  reviewed_at: z.string().nullable(),
  reviewed_by: z.string().nullable(),
});

export type ConsultantRecord = z.infer<typeof consultantSchema>;

// Partial schema for incremental updates (e.g. after each pipeline stage)
export const consultantPartialSchema = consultantSchema.partial().extend({
  run_id: z.string().uuid(),
  slug: z.string().min(1),
});

// Scrape run validation
export const scrapeRunSchema = z.object({
  run_id: z.string().uuid(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  status: z.enum(["running", "completed", "failed"]),
  total_profiles: z.number().int(),
  success_count: z.number().int(),
  error_count: z.number().int(),
});

export type ScrapeRunRecord = z.infer<typeof scrapeRunSchema>;

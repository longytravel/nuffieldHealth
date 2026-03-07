import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

type JsonSectionMap = Record<string, { heading: string; values: string[] }>;

// Scrape runs table — one row per pipeline execution
export const scrapeRuns = sqliteTable("scrape_runs", {
  run_id: text("run_id").primaryKey(),
  started_at: text("started_at").notNull(),
  completed_at: text("completed_at"),
  status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
  total_profiles: integer("total_profiles").notNull().default(0),
  success_count: integer("success_count").notNull().default(0),
  error_count: integer("error_count").notNull().default(0),
});

// Consultants table — all 40+ profile fields, keyed by (run_id, slug)
export const consultants = sqliteTable(
  "consultants",
  {
    // Key fields
    run_id: text("run_id")
      .notNull()
      .references(() => scrapeRuns.run_id),
    slug: text("slug").notNull(),

    // 3.1 Identity and Crawl Fields
    consultant_name: text("consultant_name"),
    consultant_title_prefix: text("consultant_title_prefix"),
    profile_url: text("profile_url"),
    profile_slug: text("profile_slug").notNull(),
    http_status: integer("http_status"),
    profile_status: text("profile_status", { enum: ["active", "deleted", "error"] }).notNull(),
    registration_number: text("registration_number"),
    gmc_code_for_booking: text("gmc_code_for_booking"),
    hospital_name_primary: text("hospital_name_primary"),
    hospital_code_primary: text("hospital_code_primary"),

    // 3.2 Profile Content Fields
    about_text: text("about_text"),

    // 3.3 Profile Quality Fields
    has_photo: integer("has_photo", { mode: "boolean" }),
    specialty_primary: text("specialty_primary", { mode: "json" }).$type<string[]>().notNull().default([]),
    specialty_sub: text("specialty_sub", { mode: "json" }).$type<string[]>().notNull().default([]),
    plain_english_score: integer("plain_english_score"),
    bio_depth: text("bio_depth", { enum: ["substantive", "adequate", "thin", "missing"] }),
    treatments: text("treatments", { mode: "json" }).$type<string[]>().notNull().default([]),
    treatments_excluded: text("treatments_excluded", { mode: "json" }).$type<string[]>().notNull().default([]),
    treatment_specificity_score: text("treatment_specificity_score", {
      enum: ["highly_specific", "moderately_specific", "generic", "not_applicable"],
    }),
    insurers: text("insurers", { mode: "json" }).$type<string[]>().notNull().default([]),
    insurer_count: integer("insurer_count"),
    qualifications_credentials: text("qualifications_credentials"),
    practising_since: integer("practising_since"),
    memberships: text("memberships", { mode: "json" }).$type<string[]>().notNull().default([]),
    clinical_interests: text("clinical_interests", { mode: "json" }).$type<string[]>().notNull().default([]),
    personal_interests: text("personal_interests"),
    languages: text("languages", { mode: "json" }).$type<string[]>().notNull().default([]),
    consultation_times_raw: text("consultation_times_raw", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    declaration: text("declaration", { mode: "json" }).$type<string[] | null>(),
    in_the_news: text("in_the_news", { mode: "json" }).$type<
      { title: string; url: string }[] | null
    >(),
    professional_roles: text("professional_roles"),
    patient_age_restriction: text("patient_age_restriction"),
    patient_age_restriction_min: integer("patient_age_restriction_min"),
    patient_age_restriction_max: integer("patient_age_restriction_max"),
    external_website: text("external_website"),
    cqc_rating: text("cqc_rating"),
    booking_caveat: text("booking_caveat"),
    contact_phone: text("contact_phone"),
    contact_mobile: text("contact_mobile"),
    contact_email: text("contact_email"),
    hospital_is_nuffield: integer("hospital_is_nuffield", { mode: "boolean" }),
    hospital_nuffield_at_nhs: integer("hospital_nuffield_at_nhs", { mode: "boolean" }),
    declaration_substantive: integer("declaration_substantive", { mode: "boolean" }),
    professional_interests: text("professional_interests"),

    // 3.5 AI Assessment Evidence Fields
    plain_english_reason: text("plain_english_reason"),
    bio_depth_reason: text("bio_depth_reason"),
    treatment_specificity_reason: text("treatment_specificity_reason"),
    qualifications_completeness: text("qualifications_completeness", {
      enum: ["comprehensive", "adequate", "minimal", "missing"],
    }),
    qualifications_completeness_reason: text("qualifications_completeness_reason"),
    ai_quality_notes: text("ai_quality_notes"),

    // 3.3 Booking Fields
    booking_state: text("booking_state", {
      enum: ["not_bookable", "bookable_no_slots", "bookable_with_slots"],
    }),
    online_bookable: integer("online_bookable", { mode: "boolean" }),
    available_days_next_28_days: integer("available_days_next_28_days"),
    available_slots_next_28_days: integer("available_slots_next_28_days"),
    avg_slots_per_day: real("avg_slots_per_day"),
    next_available_date: text("next_available_date"),
    days_to_first_available: integer("days_to_first_available"),
    consultation_price: real("consultation_price"),

    // 3.4 Aggregate Fields
    profile_completeness_score: real("profile_completeness_score"),
    quality_tier: text("quality_tier", { enum: ["Gold", "Silver", "Bronze", "Incomplete"] }),
    flags: text("flags", { mode: "json" })
      .$type<{ code: string; severity: string; message: string }[]>()
      .notNull()
      .default([]),

    // Pipeline Fields
    scrape_status: text("scrape_status", {
      enum: ["pending", "crawl_done", "parse_done", "booking_done", "assess_done", "complete", "error"],
    }).notNull(),
    scrape_error: text("scrape_error"),
    manually_reviewed: integer("manually_reviewed", { mode: "boolean" }).notNull().default(false),
    reviewed_at: text("reviewed_at"),
    reviewed_by: text("reviewed_by"),
  },
  (table) => [primaryKey({ columns: [table.run_id, table.slug] })]
);

// ============================================================
// Profile Rewrite Engine Tables (spec §3)
// ============================================================

// Profile rewrites — every rewrite attempt, keyed by rewrite_id
export const profileRewrites = sqliteTable(
  "profile_rewrites",
  {
    rewrite_id: text("rewrite_id").primaryKey(),
    run_id: text("run_id").notNull(),
    slug: text("slug").notNull(),
    rewrite_mode: text("rewrite_mode", { enum: ["full", "element"] }).notNull(),
    element_key: text("element_key"),
    original_content: text("original_content"),
    rewritten_content: text("rewritten_content"),
    source_ids: text("source_ids", { mode: "json" }).$type<string[]>(),
    corroboration_summary: text("corroboration_summary"),
    projected_score_delta: real("projected_score_delta"),
    projected_total_score: real("projected_total_score"),
    projected_tier: text("projected_tier", { enum: ["Gold", "Silver", "Bronze", "Incomplete"] }),
    status: text("status", { enum: ["draft", "accepted", "rejected"] }).notNull().default("draft"),
    seo_score_before: real("seo_score_before"),
    seo_score_after: real("seo_score_after"),
    created_at: text("created_at").notNull(),
    reviewed_by: text("reviewed_by"),
    reviewed_at: text("reviewed_at"),
  },
  (table) => [
    index("idx_rewrites_slug_run").on(table.slug, table.run_id),
    index("idx_rewrites_status").on(table.status),
  ]
);

// Research sources — evidence trail for every piece of research
export const researchSources = sqliteTable(
  "research_sources",
  {
    source_id: text("source_id").primaryKey(),
    rewrite_id: text("rewrite_id").notNull(),
    slug: text("slug").notNull(),
    search_query: text("search_query").notNull(),
    result_url: text("result_url").notNull(),
    result_title: text("result_title"),
    page_content_snippet: text("page_content_snippet"),
    extracted_facts: text("extracted_facts", { mode: "json" }).$type<
      { element: string; fact: string; confidence: string }[]
    >(),
    corroborated: integer("corroborated").notNull().default(0),
    reliability_notes: text("reliability_notes"),
    fetched_at: text("fetched_at").notNull(),
  },
  (table) => [
    index("idx_sources_slug_rewrite").on(table.slug, table.rewrite_id),
    index("idx_sources_corroborated").on(table.corroborated),
  ]
);

// ============================================================
// BUPA Competitor Intelligence Tables
// ============================================================

// BUPA scrape runs — one row per BUPA pipeline execution
export const bupaScrapeRuns = sqliteTable("bupa_scrape_runs", {
  run_id: text("run_id").primaryKey(),
  started_at: text("started_at").notNull(),
  completed_at: text("completed_at"),
  status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
  total_profiles: integer("total_profiles").notNull().default(0),
  success_count: integer("success_count").notNull().default(0),
  error_count: integer("error_count").notNull().default(0),
  match_count: integer("match_count").notNull().default(0),
});

// BUPA consultants — scraped BUPA profile data, keyed by (run_id, bupa_id)
export const bupaConsultants = sqliteTable(
  "bupa_consultants",
  {
    // Key fields
    run_id: text("run_id")
      .notNull()
      .references(() => bupaScrapeRuns.run_id),
    bupa_id: text("bupa_id").notNull(),

    // Identity
    bupa_slug: text("bupa_slug").notNull(),
    consultant_name: text("consultant_name"),
    registration_number: text("registration_number"),
    profile_url: text("profile_url").notNull(),
    has_photo: integer("has_photo", { mode: "boolean" }),

    // Content
    about_text: text("about_text"),
    specialty_primary: text("specialty_primary", { mode: "json" }).$type<string[]>().notNull().default([]),
    specialty_sub: text("specialty_sub", { mode: "json" }).$type<string[]>().notNull().default([]),
    treatments: text("treatments", { mode: "json" }).$type<string[]>().notNull().default([]),
    qualifications_credentials: text("qualifications_credentials"),
    memberships: text("memberships", { mode: "json" }).$type<string[]>().notNull().default([]),
    clinical_interests: text("clinical_interests", { mode: "json" }).$type<string[]>().notNull().default([]),
    languages: text("languages", { mode: "json" }).$type<string[]>().notNull().default([]),
    hospital_affiliations: text("hospital_affiliations", { mode: "json" }).$type<string[]>().notNull().default([]),
    fee_assured: integer("fee_assured", { mode: "boolean" }),
    contact_phone_numbers: text("contact_phone_numbers", { mode: "json" }).$type<string[]>().notNull().default([]),
    contact_email_addresses: text("contact_email_addresses", { mode: "json" }).$type<string[]>().notNull().default([]),
    website_urls: text("website_urls", { mode: "json" }).$type<string[]>().notNull().default([]),
    accreditation_badges: text("accreditation_badges", { mode: "json" }).$type<string[]>().notNull().default([]),
    source_sections: text("source_sections", { mode: "json" }).$type<JsonSectionMap>().notNull().default({}),
    unmapped_section_keys: text("unmapped_section_keys", { mode: "json" }).$type<string[]>().notNull().default([]),

    // AI Assessment (same fields as Nuffield)
    plain_english_score: integer("plain_english_score"),
    plain_english_reason: text("plain_english_reason"),
    bio_depth: text("bio_depth", { enum: ["substantive", "adequate", "thin", "missing"] }),
    bio_depth_reason: text("bio_depth_reason"),
    treatment_specificity_score: text("treatment_specificity_score", {
      enum: ["highly_specific", "moderately_specific", "generic", "not_applicable"],
    }),
    treatment_specificity_reason: text("treatment_specificity_reason"),
    qualifications_completeness: text("qualifications_completeness", {
      enum: ["comprehensive", "adequate", "minimal", "missing"],
    }),
    qualifications_completeness_reason: text("qualifications_completeness_reason"),
    ai_quality_notes: text("ai_quality_notes"),

    // Scoring
    profile_completeness_score: real("profile_completeness_score"),
    adjusted_score: real("adjusted_score"),
    quality_tier: text("quality_tier", { enum: ["Gold", "Silver", "Bronze", "Incomplete"] }),
    flags: text("flags", { mode: "json" })
      .$type<{ code: string; severity: string; message: string }[]>()
      .notNull()
      .default([]),

    // Pipeline
    scrape_status: text("scrape_status", {
      enum: ["pending", "crawl_done", "parse_done", "assess_done", "complete", "error"],
    }).notNull(),
    scrape_error: text("scrape_error"),
  },
  (table) => [
    primaryKey({ columns: [table.run_id, table.bupa_id] }),
    index("idx_bupa_consultants_reg").on(table.registration_number),
  ]
);

// Consultant matches — links Nuffield consultants to BUPA profiles
export const consultantMatches = sqliteTable(
  "consultant_matches",
  {
    match_id: text("match_id").primaryKey(),
    nuffield_slug: text("nuffield_slug").notNull(),
    bupa_id: text("bupa_id").notNull(),
    match_method: text("match_method", { enum: ["sitemap", "name_search", "gmc_match"] }).notNull(),
    match_confidence: text("match_confidence", { enum: ["high", "medium", "low"] }).notNull(),
    registration_number: text("registration_number"),
    matched_at: text("matched_at").notNull(),
  },
  (table) => [
    index("idx_matches_nuffield_slug").on(table.nuffield_slug),
    index("idx_matches_bupa_id").on(table.bupa_id),
  ]
);

// Consultant photos — downloaded photographs
export const consultantPhotos = sqliteTable(
  "consultant_photos",
  {
    photo_id: text("photo_id").primaryKey(),
    slug: text("slug").notNull().unique(),
    file_path: text("file_path").notNull(),
    source_url: text("source_url").notNull(),
    source_attribution: text("source_attribution"),
    width: integer("width"),
    height: integer("height"),
    file_size_bytes: integer("file_size_bytes"),
    downloaded_at: text("downloaded_at").notNull(),
    verified_by: text("verified_by"),
    verified_at: text("verified_at"),
  }
);

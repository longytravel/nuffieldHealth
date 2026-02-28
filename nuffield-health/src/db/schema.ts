import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

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

    // 3.2 Profile Quality Fields
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
    consultation_price: text("consultation_price"),

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

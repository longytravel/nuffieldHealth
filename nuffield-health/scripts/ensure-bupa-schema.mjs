import { existsSync } from "fs";
import { createClient } from "@libsql/client";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const db = createClient({ url, authToken });

const statements = [
  `CREATE TABLE IF NOT EXISTS bupa_scrape_runs (
    run_id text PRIMARY KEY NOT NULL,
    started_at text NOT NULL,
    completed_at text,
    status text NOT NULL,
    total_profiles integer DEFAULT 0 NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    match_count integer DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bupa_consultants (
    run_id text NOT NULL,
    bupa_id text NOT NULL,
    bupa_slug text NOT NULL,
    consultant_name text,
    registration_number text,
    profile_url text NOT NULL,
    has_photo integer,
    about_text text,
    specialty_primary text DEFAULT '[]' NOT NULL,
    specialty_sub text DEFAULT '[]' NOT NULL,
    treatments text DEFAULT '[]' NOT NULL,
    qualifications_credentials text,
    memberships text DEFAULT '[]' NOT NULL,
    clinical_interests text DEFAULT '[]' NOT NULL,
    languages text DEFAULT '[]' NOT NULL,
    hospital_affiliations text DEFAULT '[]' NOT NULL,
    fee_assured integer,
    contact_phone_numbers text DEFAULT '[]' NOT NULL,
    contact_email_addresses text DEFAULT '[]' NOT NULL,
    website_urls text DEFAULT '[]' NOT NULL,
    accreditation_badges text DEFAULT '[]' NOT NULL,
    source_sections text DEFAULT '{}' NOT NULL,
    unmapped_section_keys text DEFAULT '[]' NOT NULL,
    plain_english_score integer,
    plain_english_reason text,
    bio_depth text,
    bio_depth_reason text,
    treatment_specificity_score text,
    treatment_specificity_reason text,
    qualifications_completeness text,
    qualifications_completeness_reason text,
    ai_quality_notes text,
    profile_completeness_score real,
    adjusted_score real,
    quality_tier text,
    flags text DEFAULT '[]' NOT NULL,
    scrape_status text NOT NULL,
    scrape_error text,
    PRIMARY KEY(run_id, bupa_id),
    FOREIGN KEY (run_id) REFERENCES bupa_scrape_runs(run_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bupa_consultants_reg ON bupa_consultants (registration_number)`,
  `CREATE TABLE IF NOT EXISTS consultant_matches (
    match_id text PRIMARY KEY NOT NULL,
    nuffield_slug text NOT NULL,
    bupa_id text NOT NULL,
    match_method text NOT NULL,
    match_confidence text NOT NULL,
    registration_number text,
    matched_at text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_matches_nuffield_slug ON consultant_matches (nuffield_slug)`,
  `CREATE INDEX IF NOT EXISTS idx_matches_bupa_id ON consultant_matches (bupa_id)`,
];

const bupaConsultantColumns = [
  ["contact_phone_numbers", "ALTER TABLE bupa_consultants ADD COLUMN contact_phone_numbers text DEFAULT '[]' NOT NULL"],
  ["contact_email_addresses", "ALTER TABLE bupa_consultants ADD COLUMN contact_email_addresses text DEFAULT '[]' NOT NULL"],
  ["website_urls", "ALTER TABLE bupa_consultants ADD COLUMN website_urls text DEFAULT '[]' NOT NULL"],
  ["accreditation_badges", "ALTER TABLE bupa_consultants ADD COLUMN accreditation_badges text DEFAULT '[]' NOT NULL"],
  ["source_sections", "ALTER TABLE bupa_consultants ADD COLUMN source_sections text DEFAULT '{}' NOT NULL"],
  ["unmapped_section_keys", "ALTER TABLE bupa_consultants ADD COLUMN unmapped_section_keys text DEFAULT '[]' NOT NULL"],
];

for (const sql of statements) {
  await db.execute(sql);
}

const columnInfo = await db.execute(`PRAGMA table_info('bupa_consultants')`);
const existingColumns = new Set(columnInfo.rows.map((row) => String(row.name)));

for (const [columnName, sql] of bupaConsultantColumns) {
  if (!existingColumns.has(columnName)) {
    await db.execute(sql);
  }
}

const tables = await db.execute(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table'
    AND name IN ('bupa_scrape_runs', 'bupa_consultants', 'consultant_matches')
  ORDER BY name
`);

console.log(`Ensured BUPA schema in Turso (${tables.rows.length} tables present)`);

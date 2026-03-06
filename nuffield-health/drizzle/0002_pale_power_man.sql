CREATE TABLE `bupa_consultants` (
	`run_id` text NOT NULL,
	`bupa_id` text NOT NULL,
	`bupa_slug` text NOT NULL,
	`consultant_name` text,
	`registration_number` text,
	`profile_url` text NOT NULL,
	`has_photo` integer,
	`about_text` text,
	`specialty_primary` text DEFAULT '[]' NOT NULL,
	`specialty_sub` text DEFAULT '[]' NOT NULL,
	`treatments` text DEFAULT '[]' NOT NULL,
	`qualifications_credentials` text,
	`memberships` text DEFAULT '[]' NOT NULL,
	`clinical_interests` text DEFAULT '[]' NOT NULL,
	`languages` text DEFAULT '[]' NOT NULL,
	`hospital_affiliations` text DEFAULT '[]' NOT NULL,
	`fee_assured` integer,
	`plain_english_score` integer,
	`plain_english_reason` text,
	`bio_depth` text,
	`bio_depth_reason` text,
	`treatment_specificity_score` text,
	`treatment_specificity_reason` text,
	`qualifications_completeness` text,
	`qualifications_completeness_reason` text,
	`ai_quality_notes` text,
	`profile_completeness_score` real,
	`adjusted_score` real,
	`quality_tier` text,
	`flags` text DEFAULT '[]' NOT NULL,
	`scrape_status` text NOT NULL,
	`scrape_error` text,
	PRIMARY KEY(`run_id`, `bupa_id`),
	FOREIGN KEY (`run_id`) REFERENCES `bupa_scrape_runs`(`run_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bupa_consultants_reg` ON `bupa_consultants` (`registration_number`);--> statement-breakpoint
CREATE TABLE `bupa_scrape_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`total_profiles` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`match_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `consultant_matches` (
	`match_id` text PRIMARY KEY NOT NULL,
	`nuffield_slug` text NOT NULL,
	`bupa_id` text NOT NULL,
	`match_method` text NOT NULL,
	`match_confidence` text NOT NULL,
	`registration_number` text,
	`matched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_matches_nuffield_slug` ON `consultant_matches` (`nuffield_slug`);--> statement-breakpoint
CREATE INDEX `idx_matches_bupa_id` ON `consultant_matches` (`bupa_id`);--> statement-breakpoint
CREATE TABLE `consultant_photos` (
	`photo_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`file_path` text NOT NULL,
	`source_url` text NOT NULL,
	`source_attribution` text,
	`width` integer,
	`height` integer,
	`file_size_bytes` integer,
	`downloaded_at` text NOT NULL,
	`verified_by` text,
	`verified_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consultant_photos_slug_unique` ON `consultant_photos` (`slug`);--> statement-breakpoint
CREATE TABLE `profile_rewrites` (
	`rewrite_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`slug` text NOT NULL,
	`rewrite_mode` text NOT NULL,
	`element_key` text,
	`original_content` text,
	`rewritten_content` text,
	`source_ids` text,
	`corroboration_summary` text,
	`projected_score_delta` real,
	`projected_total_score` real,
	`projected_tier` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`seo_score_before` real,
	`seo_score_after` real,
	`created_at` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_rewrites_slug_run` ON `profile_rewrites` (`slug`,`run_id`);--> statement-breakpoint
CREATE INDEX `idx_rewrites_status` ON `profile_rewrites` (`status`);--> statement-breakpoint
CREATE TABLE `research_sources` (
	`source_id` text PRIMARY KEY NOT NULL,
	`rewrite_id` text NOT NULL,
	`slug` text NOT NULL,
	`search_query` text NOT NULL,
	`result_url` text NOT NULL,
	`result_title` text,
	`page_content_snippet` text,
	`extracted_facts` text,
	`corroborated` integer DEFAULT 0 NOT NULL,
	`reliability_notes` text,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sources_slug_rewrite` ON `research_sources` (`slug`,`rewrite_id`);--> statement-breakpoint
CREATE INDEX `idx_sources_corroborated` ON `research_sources` (`corroborated`);--> statement-breakpoint
DROP INDEX "idx_bupa_consultants_reg";--> statement-breakpoint
DROP INDEX "idx_matches_nuffield_slug";--> statement-breakpoint
DROP INDEX "idx_matches_bupa_id";--> statement-breakpoint
DROP INDEX "consultant_photos_slug_unique";--> statement-breakpoint
DROP INDEX "idx_rewrites_slug_run";--> statement-breakpoint
DROP INDEX "idx_rewrites_status";--> statement-breakpoint
DROP INDEX "idx_sources_slug_rewrite";--> statement-breakpoint
DROP INDEX "idx_sources_corroborated";--> statement-breakpoint
ALTER TABLE `consultants` ALTER COLUMN "consultation_price" TO "consultation_price" real;--> statement-breakpoint
ALTER TABLE `consultants` ADD `about_text` text;
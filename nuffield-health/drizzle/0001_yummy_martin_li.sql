ALTER TABLE `consultants` ADD `professional_interests` text;--> statement-breakpoint
ALTER TABLE `consultants` ADD `plain_english_reason` text;--> statement-breakpoint
ALTER TABLE `consultants` ADD `bio_depth_reason` text;--> statement-breakpoint
ALTER TABLE `consultants` ADD `treatment_specificity_reason` text;--> statement-breakpoint
ALTER TABLE `consultants` ADD `qualifications_completeness` text;--> statement-breakpoint
ALTER TABLE `consultants` ADD `qualifications_completeness_reason` text;--> statement-breakpoint
ALTER TABLE `consultants` ADD `ai_quality_notes` text;--> statement-breakpoint
ALTER TABLE `consultants` ADD `available_days_next_28_days` integer;--> statement-breakpoint
ALTER TABLE `consultants` ADD `avg_slots_per_day` real;--> statement-breakpoint
ALTER TABLE `consultants` ADD `days_to_first_available` integer;
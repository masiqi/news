ALTER TABLE `processed_contents` ADD `topics` text;--> statement-breakpoint
ALTER TABLE `processed_contents` ADD `images` text;--> statement-breakpoint
ALTER TABLE `processed_contents` ADD `links` text;--> statement-breakpoint
ALTER TABLE `processed_contents` ADD `author` text;--> statement-breakpoint
ALTER TABLE `processed_contents` ADD `source` text;--> statement-breakpoint
ALTER TABLE `processed_contents` ADD `publish_time` text;--> statement-breakpoint
ALTER TABLE `processed_contents` ADD `analysis` text;--> statement-breakpoint
ALTER TABLE `processed_contents` ADD `educational_value` text;--> statement-breakpoint
ALTER TABLE `processed_contents` ADD `word_count` integer;--> statement-breakpoint
CREATE INDEX `idx_processed_contents_topics` ON `processed_contents` (`topics`);--> statement-breakpoint
CREATE INDEX `idx_processed_contents_source` ON `processed_contents` (`source`);--> statement-breakpoint
CREATE INDEX `idx_processed_contents_author` ON `processed_contents` (`author`);--> statement-breakpoint
CREATE INDEX `idx_processed_contents_model_used` ON `processed_contents` (`model_used`);
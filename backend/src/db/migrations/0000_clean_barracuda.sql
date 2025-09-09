CREATE TABLE `credential_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`credential_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`action` text DEFAULT 'created' NOT NULL,
	`ip_address` text NOT NULL,
	`user_agent` text,
	`timestamp` integer NOT NULL,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`credential_id`) REFERENCES `sync_credentials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_credential_logs_credential_id` ON `credential_logs` (`credential_id`);--> statement-breakpoint
CREATE INDEX `idx_credential_logs_user_id` ON `credential_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_credential_logs_action` ON `credential_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_credential_logs_timestamp` ON `credential_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_credential_logs_created_at` ON `credential_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `message_histories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`status` text NOT NULL,
	`timestamp` integer NOT NULL,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`processing_time` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_message_histories_message_id` ON `message_histories` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_message_histories_status` ON `message_histories` (`status`);--> statement-breakpoint
CREATE INDEX `idx_message_histories_timestamp` ON `message_histories` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_message_histories_created_at` ON `message_histories` (`created_at`);--> statement-breakpoint
CREATE TABLE `notification_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`data` text,
	`is_read` integer DEFAULT false NOT NULL,
	`sent_via` text DEFAULT 'realtime' NOT NULL,
	`scheduled_for` integer,
	`sent_at` integer,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notification_records_user_id` ON `notification_records` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_records_type` ON `notification_records` (`type`);--> statement-breakpoint
CREATE INDEX `idx_notification_records_is_read` ON `notification_records` (`is_read`);--> statement-breakpoint
CREATE INDEX `idx_notification_records_sent_via` ON `notification_records` (`sent_via`);--> statement-breakpoint
CREATE INDEX `idx_notification_records_created_at` ON `notification_records` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notification_records_scheduled_for` ON `notification_records` (`scheduled_for`);--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`enable_realtime_notifications` integer DEFAULT true NOT NULL,
	`enable_email_notifications` integer DEFAULT false NOT NULL,
	`notify_on_completed` integer DEFAULT true NOT NULL,
	`notify_on_failed` integer DEFAULT true NOT NULL,
	`notify_on_error` integer DEFAULT true NOT NULL,
	`email_frequency` text DEFAULT 'immediate' NOT NULL,
	`quiet_hours_enabled` integer DEFAULT false NOT NULL,
	`quiet_hours_start` text,
	`quiet_hours_end` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_settings_user_id_unique` ON `notification_settings` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_notification_settings_user_id` ON `notification_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_settings_enable_realtime` ON `notification_settings` (`enable_realtime_notifications`);--> statement-breakpoint
CREATE INDEX `idx_notification_settings_enable_email` ON `notification_settings` (`enable_email_notifications`);--> statement-breakpoint
CREATE INDEX `idx_notification_settings_created_at` ON `notification_settings` (`created_at`);--> statement-breakpoint
CREATE TABLE `processed_contents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`summary` text NOT NULL,
	`markdown_content` text NOT NULL,
	`keywords` text,
	`sentiment` text,
	`processing_time` integer,
	`model_used` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `rss_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_processed_contents_entry_id` ON `processed_contents` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_processed_contents_created_at` ON `processed_contents` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_processed_contents_keywords` ON `processed_contents` (`keywords`);--> statement-breakpoint
CREATE TABLE `processing_statuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`status` text NOT NULL,
	`user_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `processing_statuses_message_id_unique` ON `processing_statuses` (`message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_processing_statuses_message_id` ON `processing_statuses` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_processing_statuses_status` ON `processing_statuses` (`status`);--> statement-breakpoint
CREATE INDEX `idx_processing_statuses_user_id` ON `processing_statuses` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_processing_statuses_source_id` ON `processing_statuses` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_processing_statuses_created_at` ON `processing_statuses` (`created_at`);--> statement-breakpoint
CREATE TABLE `processing_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`task_type` text NOT NULL,
	`status` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`error_message` text,
	`result_data` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`estimated_duration` integer,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_processing_tasks_user_id` ON `processing_tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_processing_tasks_source_id` ON `processing_tasks` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_processing_tasks_status` ON `processing_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_processing_tasks_type` ON `processing_tasks` (`task_type`);--> statement-breakpoint
CREATE INDEX `idx_processing_tasks_created_at` ON `processing_tasks` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_processing_tasks_started_at` ON `processing_tasks` (`started_at`);--> statement-breakpoint
CREATE TABLE `queue_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`queue_name` text NOT NULL,
	`pending_messages` integer DEFAULT 0 NOT NULL,
	`processing_messages` integer DEFAULT 0 NOT NULL,
	`failed_messages` integer DEFAULT 0 NOT NULL,
	`dead_letter_messages` integer DEFAULT 0 NOT NULL,
	`average_processing_time` integer DEFAULT 0 NOT NULL,
	`last_updated` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unq_queue_stats_queue_name` ON `queue_stats` (`queue_name`);--> statement-breakpoint
CREATE INDEX `idx_queue_stats_last_updated` ON `queue_stats` (`last_updated`);--> statement-breakpoint
CREATE INDEX `idx_queue_stats_created_at` ON `queue_stats` (`created_at`);--> statement-breakpoint
CREATE TABLE `rss_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`guid` text NOT NULL,
	`title` text NOT NULL,
	`link` text NOT NULL,
	`content` text,
	`published_at` integer NOT NULL,
	`processed` integer DEFAULT false NOT NULL,
	`processed_at` integer,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rss_entries_source_id` ON `rss_entries` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_rss_entries_guid` ON `rss_entries` (`guid`);--> statement-breakpoint
CREATE INDEX `idx_rss_entries_processed` ON `rss_entries` (`processed`);--> statement-breakpoint
CREATE INDEX `idx_rss_entries_published_at` ON `rss_entries` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_rss_entries_created_at` ON `rss_entries` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_rss_entries_guid` ON `rss_entries` (`guid`);--> statement-breakpoint
CREATE TABLE `source_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_categories_name_unique` ON `source_categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_source_categories_name` ON `source_categories` (`name`);--> statement-breakpoint
CREATE INDEX `idx_source_categories_is_active` ON `source_categories` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_source_categories_sort_order` ON `source_categories` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_source_categories_created_at` ON `source_categories` (`created_at`);--> statement-breakpoint
CREATE TABLE `source_category_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `source_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_source_category_relations_source_id` ON `source_category_relations` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_source_category_relations_category_id` ON `source_category_relations` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_source_category_relations_created_at` ON `source_category_relations` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_source_category_relations_source_category` ON `source_category_relations` (`source_id`,`category_id`);--> statement-breakpoint
CREATE TABLE `source_tag_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `source_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_source_tag_relations_source_id` ON `source_tag_relations` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_source_tag_relations_tag_id` ON `source_tag_relations` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_source_tag_relations_created_at` ON `source_tag_relations` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_source_tag_relations_source_tag` ON `source_tag_relations` (`source_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `source_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`is_active` integer DEFAULT true NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_tags_name_unique` ON `source_tags` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_source_tags_name` ON `source_tags` (`name`);--> statement-breakpoint
CREATE INDEX `idx_source_tags_is_active` ON `source_tags` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_source_tags_usage_count` ON `source_tags` (`usage_count`);--> statement-breakpoint
CREATE INDEX `idx_source_tags_created_at` ON `source_tags` (`created_at`);--> statement-breakpoint
CREATE TABLE `source_validation_histories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`validation_type` text NOT NULL,
	`availability_score` integer,
	`content_quality_score` integer,
	`update_frequency_score` integer,
	`overall_score` integer,
	`status` text NOT NULL,
	`error_message` text,
	`validation_details` text,
	`validated_by` integer,
	`validated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`validated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_source_validation_histories_source_id` ON `source_validation_histories` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_source_validation_histories_validation_type` ON `source_validation_histories` (`validation_type`);--> statement-breakpoint
CREATE INDEX `idx_source_validation_histories_status` ON `source_validation_histories` (`status`);--> statement-breakpoint
CREATE INDEX `idx_source_validation_histories_validated_at` ON `source_validation_histories` (`validated_at`);--> statement-breakpoint
CREATE INDEX `idx_source_validation_histories_created_at` ON `source_validation_histories` (`created_at`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`url` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_public` integer DEFAULT false NOT NULL,
	`original_source_id` integer,
	`last_fetched_at` integer,
	`fetch_failure_count` integer DEFAULT 0 NOT NULL,
	`fetch_error_message` text,
	`is_recommended` integer DEFAULT false NOT NULL,
	`recommendation_level` text DEFAULT 'basic' NOT NULL,
	`quality_availability` integer DEFAULT 0 NOT NULL,
	`quality_content_quality` integer DEFAULT 0 NOT NULL,
	`quality_update_frequency` integer DEFAULT 0 NOT NULL,
	`quality_last_validated_at` integer,
	`quality_validation_status` text DEFAULT 'pending' NOT NULL,
	`quality_validation_notes` text,
	`statistics_total_subscribers` integer DEFAULT 0 NOT NULL,
	`statistics_active_subscribers` integer DEFAULT 0 NOT NULL,
	`statistics_average_usage` integer DEFAULT 0 NOT NULL,
	`statistics_satisfaction` integer DEFAULT 0 NOT NULL,
	`recommended_by` integer,
	`recommended_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recommended_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sources_user_id` ON `sources` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sources_url` ON `sources` (`url`);--> statement-breakpoint
CREATE INDEX `idx_sources_is_public` ON `sources` (`is_public`);--> statement-breakpoint
CREATE INDEX `idx_sources_is_recommended` ON `sources` (`is_recommended`);--> statement-breakpoint
CREATE INDEX `idx_sources_recommendation_level` ON `sources` (`recommendation_level`);--> statement-breakpoint
CREATE INDEX `idx_sources_quality_validation_status` ON `sources` (`quality_validation_status`);--> statement-breakpoint
CREATE INDEX `idx_sources_created_at` ON `sources` (`created_at`);--> statement-breakpoint
CREATE TABLE `status_histories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`previous_status` text NOT NULL,
	`new_status` text NOT NULL,
	`progress` integer NOT NULL,
	`message` text,
	`metadata` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `processing_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_status_histories_task_id` ON `status_histories` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_status_histories_timestamp` ON `status_histories` (`timestamp`);--> statement-breakpoint
CREATE TABLE `sync_credentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`access_key_id` text NOT NULL,
	`secret_access_key` text NOT NULL,
	`region` text NOT NULL,
	`endpoint` text NOT NULL,
	`bucket` text NOT NULL,
	`prefix` text NOT NULL,
	`permissions` text DEFAULT 'readonly' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_used_at` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sync_credentials_user_id` ON `sync_credentials` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sync_credentials_is_active` ON `sync_credentials` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_sync_credentials_expires_at` ON `sync_credentials` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_credentials_created_at` ON `sync_credentials` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`entry_id` integer NOT NULL,
	`processed_content_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`personal_tags` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`read_status` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_id`) REFERENCES `rss_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_content_id`) REFERENCES `processed_contents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_notes_user_id` ON `user_notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_notes_entry_id` ON `user_notes` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_user_notes_processed_content_id` ON `user_notes` (`processed_content_id`);--> statement-breakpoint
CREATE INDEX `idx_user_notes_is_favorite` ON `user_notes` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_user_notes_read_status` ON `user_notes` (`read_status`);--> statement-breakpoint
CREATE INDEX `idx_user_notes_created_at` ON `user_notes` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_operation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`admin_id` integer NOT NULL,
	`operation` text NOT NULL,
	`details` text,
	`ip_address` text NOT NULL,
	`user_agent` text,
	`result` text DEFAULT 'success' NOT NULL,
	`error_message` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_operation_logs_user_id` ON `user_operation_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_operation_logs_admin_id` ON `user_operation_logs` (`admin_id`);--> statement-breakpoint
CREATE INDEX `idx_user_operation_logs_operation` ON `user_operation_logs` (`operation`);--> statement-breakpoint
CREATE INDEX `idx_user_operation_logs_result` ON `user_operation_logs` (`result`);--> statement-breakpoint
CREATE INDEX `idx_user_operation_logs_timestamp` ON `user_operation_logs` (`timestamp`);--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`resource` text NOT NULL,
	`action` text NOT NULL,
	`conditions` text,
	`is_system_permission` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_permissions_name_unique` ON `user_permissions` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_permissions_name` ON `user_permissions` (`name`);--> statement-breakpoint
CREATE INDEX `idx_user_permissions_resource_action` ON `user_permissions` (`resource`,`action`);--> statement-breakpoint
CREATE INDEX `idx_user_permissions_is_active` ON `user_permissions` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_user_permissions_created_at` ON `user_permissions` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_role_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`assigned_by` integer,
	`assigned_at` integer NOT NULL,
	`expires_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `user_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_role_relations_user_id` ON `user_role_relations` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_role_relations_role_id` ON `user_role_relations` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_user_role_relations_is_active` ON `user_role_relations` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_user_role_relations_assigned_at` ON `user_role_relations` (`assigned_at`);--> statement-breakpoint
CREATE INDEX `idx_user_role_relations_expires_at` ON `user_role_relations` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_user_role_relations_created_at` ON `user_role_relations` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_role_relations_user_role` ON `user_role_relations` (`user_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`permissions` text NOT NULL,
	`is_system_role` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_roles_name_unique` ON `user_roles` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_roles_name` ON `user_roles` (`name`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_is_active` ON `user_roles` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_sort_order` ON `user_roles` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_created_at` ON `user_roles` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`session_id` text NOT NULL,
	`token` text NOT NULL,
	`ip_address` text NOT NULL,
	`user_agent` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_activity_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_session_id_unique` ON `user_sessions` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_user_id` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_sessions_session_id` ON `user_sessions` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_is_active` ON `user_sessions` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_expires_at` ON `user_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_last_activity_at` ON `user_sessions` (`last_activity_at`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_created_at` ON `user_sessions` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`language` text DEFAULT 'zh-CN' NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`theme` text DEFAULT 'light' NOT NULL,
	`notifications_enabled` integer DEFAULT true NOT NULL,
	`email_notifications` integer DEFAULT true NOT NULL,
	`daily_digest` integer DEFAULT false NOT NULL,
	`settings` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_id_unique` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_settings_user_id` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_settings_language` ON `user_settings` (`language`);--> statement-breakpoint
CREATE INDEX `idx_user_settings_timezone` ON `user_settings` (`timezone`);--> statement-breakpoint
CREATE INDEX `idx_user_settings_theme` ON `user_settings` (`theme`);--> statement-breakpoint
CREATE INDEX `idx_user_settings_created_at` ON `user_settings` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_statistics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`total_tasks` integer DEFAULT 0 NOT NULL,
	`completed_tasks` integer DEFAULT 0 NOT NULL,
	`failed_tasks` integer DEFAULT 0 NOT NULL,
	`processing_tasks` integer DEFAULT 0 NOT NULL,
	`average_processing_time` integer DEFAULT 0,
	`tasks_today` integer DEFAULT 0 NOT NULL,
	`tasks_this_week` integer DEFAULT 0 NOT NULL,
	`tasks_this_month` integer DEFAULT 0 NOT NULL,
	`last_updated` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_statistics_user_id_unique` ON `user_statistics` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_statistics_user_id` ON `user_statistics` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_statistics_last_updated` ON `user_statistics` (`last_updated`);--> statement-breakpoint
CREATE INDEX `idx_user_statistics_created_at` ON `user_statistics` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`login_count` integer DEFAULT 0 NOT NULL,
	`last_login_at` integer,
	`last_login_ip` text,
	`registered_ip` text,
	`risk_level` text DEFAULT 'low' NOT NULL,
	`risk_score` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_status` ON `users` (`status`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_created_at` ON `users` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_users_risk_level` ON `users` (`risk_level`);
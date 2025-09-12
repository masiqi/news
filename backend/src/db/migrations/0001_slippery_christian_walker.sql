CREATE TABLE `alert_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` integer NOT NULL,
	`triggered_at` integer NOT NULL,
	`resolved_at` integer,
	`value` integer NOT NULL,
	`message` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`notifications_sent` text NOT NULL,
	`metadata` text,
	`acknowledged_by` integer,
	`acknowledged_at` integer,
	`resolution_note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `alert_rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_alert_records_rule_id` ON `alert_records` (`rule_id`);--> statement-breakpoint
CREATE INDEX `idx_alert_records_status` ON `alert_records` (`status`);--> statement-breakpoint
CREATE INDEX `idx_alert_records_severity` ON `alert_records` (`severity`);--> statement-breakpoint
CREATE INDEX `idx_alert_records_triggered_at` ON `alert_records` (`triggered_at`);--> statement-breakpoint
CREATE INDEX `idx_alert_records_acknowledged_by` ON `alert_records` (`acknowledged_by`);--> statement-breakpoint
CREATE INDEX `idx_alert_records_created_at` ON `alert_records` (`created_at`);--> statement-breakpoint
CREATE TABLE `alert_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`metric` text NOT NULL,
	`condition` text NOT NULL,
	`threshold` integer NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`severity` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`notification_channels` text NOT NULL,
	`description` text,
	`cooldown_period` integer DEFAULT 300 NOT NULL,
	`max_notifications` integer DEFAULT 10 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_alert_rules_metric` ON `alert_rules` (`metric`);--> statement-breakpoint
CREATE INDEX `idx_alert_rules_severity` ON `alert_rules` (`severity`);--> statement-breakpoint
CREATE INDEX `idx_alert_rules_enabled` ON `alert_rules` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_alert_rules_is_active` ON `alert_rules` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_alert_rules_created_by` ON `alert_rules` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_alert_rules_created_at` ON `alert_rules` (`created_at`);--> statement-breakpoint
CREATE TABLE `monitoring_aggregates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`metric_type` text NOT NULL,
	`time_range` text NOT NULL,
	`timestamp` integer NOT NULL,
	`min_value` integer NOT NULL,
	`max_value` integer NOT NULL,
	`avg_value` integer NOT NULL,
	`sum_value` integer NOT NULL,
	`count` integer NOT NULL,
	`service` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_monitoring_aggregates_metric_type` ON `monitoring_aggregates` (`metric_type`);--> statement-breakpoint
CREATE INDEX `idx_monitoring_aggregates_time_range` ON `monitoring_aggregates` (`time_range`);--> statement-breakpoint
CREATE INDEX `idx_monitoring_aggregates_timestamp` ON `monitoring_aggregates` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_monitoring_aggregates_service` ON `monitoring_aggregates` (`service`);--> statement-breakpoint
CREATE INDEX `idx_monitoring_aggregates_created_at` ON `monitoring_aggregates` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_monitoring_aggregates_metric_time_range_timestamp` ON `monitoring_aggregates` (`metric_type`,`time_range`,`timestamp`);--> statement-breakpoint
CREATE TABLE `queue_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`queue_name` text NOT NULL,
	`pending_messages` integer DEFAULT 0 NOT NULL,
	`processing_messages` integer DEFAULT 0 NOT NULL,
	`failed_messages` integer DEFAULT 0 NOT NULL,
	`completed_messages` integer DEFAULT 0 NOT NULL,
	`dead_letter_messages` integer DEFAULT 0 NOT NULL,
	`avg_processing_time` integer DEFAULT 0 NOT NULL,
	`last_processed` integer,
	`throughput` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`ttl` integer DEFAULT 86400 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_updated` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `queue_status_queue_name_unique` ON `queue_status` (`queue_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_queue_status_queue_name` ON `queue_status` (`queue_name`);--> statement-breakpoint
CREATE INDEX `idx_queue_status_is_active` ON `queue_status` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_queue_status_last_updated` ON `queue_status` (`last_updated`);--> statement-breakpoint
CREATE INDEX `idx_queue_status_created_at` ON `queue_status` (`created_at`);--> statement-breakpoint
CREATE TABLE `service_health` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_name` text NOT NULL,
	`status` text NOT NULL,
	`last_check` integer NOT NULL,
	`response_time` integer NOT NULL,
	`error_message` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`uptime` integer NOT NULL,
	`last_failure` integer,
	`recovery_time` integer,
	`check_interval` integer DEFAULT 60 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_health_service_name_unique` ON `service_health` (`service_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_service_health_service_name` ON `service_health` (`service_name`);--> statement-breakpoint
CREATE INDEX `idx_service_health_status` ON `service_health` (`status`);--> statement-breakpoint
CREATE INDEX `idx_service_health_last_check` ON `service_health` (`last_check`);--> statement-breakpoint
CREATE INDEX `idx_service_health_is_active` ON `service_health` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_service_health_created_at` ON `service_health` (`created_at`);--> statement-breakpoint
CREATE TABLE `system_event_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_type` text NOT NULL,
	`event_name` text NOT NULL,
	`service` text NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`user_id` integer,
	`ip_address` text,
	`user_agent` text,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_system_event_logs_event_type` ON `system_event_logs` (`event_type`);--> statement-breakpoint
CREATE INDEX `idx_system_event_logs_event_name` ON `system_event_logs` (`event_name`);--> statement-breakpoint
CREATE INDEX `idx_system_event_logs_service` ON `system_event_logs` (`service`);--> statement-breakpoint
CREATE INDEX `idx_system_event_logs_level` ON `system_event_logs` (`level`);--> statement-breakpoint
CREATE INDEX `idx_system_event_logs_timestamp` ON `system_event_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_system_event_logs_user_id` ON `system_event_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_system_event_logs_created_at` ON `system_event_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `system_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`service` text NOT NULL,
	`cpu_usage` integer NOT NULL,
	`memory_usage` integer NOT NULL,
	`disk_usage` integer NOT NULL,
	`network_in` integer NOT NULL,
	`network_out` integer NOT NULL,
	`response_time` integer NOT NULL,
	`error_rate` integer NOT NULL,
	`active_connections` integer NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_system_metrics_timestamp` ON `system_metrics` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_system_metrics_service` ON `system_metrics` (`service`);--> statement-breakpoint
CREATE INDEX `idx_system_metrics_cpu_usage` ON `system_metrics` (`cpu_usage`);--> statement-breakpoint
CREATE INDEX `idx_system_metrics_memory_usage` ON `system_metrics` (`memory_usage`);--> statement-breakpoint
CREATE INDEX `idx_system_metrics_created_at` ON `system_metrics` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_activity_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` integer NOT NULL,
	`total_users` integer DEFAULT 0 NOT NULL,
	`active_users` integer DEFAULT 0 NOT NULL,
	`new_users` integer DEFAULT 0 NOT NULL,
	`sessions_count` integer DEFAULT 0 NOT NULL,
	`page_views` integer DEFAULT 0 NOT NULL,
	`avg_session_duration` integer DEFAULT 0 NOT NULL,
	`top_actions` text,
	`device_stats` text,
	`browser_stats` text,
	`region_stats` text,
	`hour_stats` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_activity_stats_date` ON `user_activity_stats` (`date`);--> statement-breakpoint
CREATE INDEX `idx_user_activity_stats_total_users` ON `user_activity_stats` (`total_users`);--> statement-breakpoint
CREATE INDEX `idx_user_activity_stats_active_users` ON `user_activity_stats` (`active_users`);--> statement-breakpoint
CREATE INDEX `idx_user_activity_stats_created_at` ON `user_activity_stats` (`created_at`);
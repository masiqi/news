CREATE TABLE `access_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`access_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`token_type` text DEFAULT 'bearer' NOT NULL,
	`scope` text DEFAULT 'r2:read' NOT NULL,
	`expires_at` integer,
	`is_revoked` integer DEFAULT false NOT NULL,
	`last_used_at` integer,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`ip_whitelist` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`access_id`) REFERENCES `user_r2_access`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_tokens_token_hash_unique` ON `access_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_access_tokens_user_id` ON `access_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_access_tokens_access_id` ON `access_tokens` (`access_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_access_tokens_token_hash` ON `access_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_access_tokens_expires_at` ON `access_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_access_tokens_is_revoked` ON `access_tokens` (`is_revoked`);--> statement-breakpoint
CREATE INDEX `idx_access_tokens_created_at` ON `access_tokens` (`created_at`);--> statement-breakpoint
CREATE TABLE `content_keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_analysis_id` integer NOT NULL,
	`keyword_id` integer NOT NULL,
	`weight` real NOT NULL,
	`context` text,
	`position_in_content` integer,
	`is_significant` integer DEFAULT false,
	FOREIGN KEY (`content_analysis_id`) REFERENCES `enhanced_content_analysis`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`keyword_id`) REFERENCES `keywords`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_content_keywords_analysis` ON `content_keywords` (`content_analysis_id`);--> statement-breakpoint
CREATE INDEX `idx_content_keywords_keyword` ON `content_keywords` (`keyword_id`);--> statement-breakpoint
CREATE INDEX `idx_content_keywords_weight` ON `content_keywords` (`weight`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_content_keywords_analysis_keyword` ON `content_keywords` (`content_analysis_id`,`keyword_id`);--> statement-breakpoint
CREATE TABLE `content_library` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_hash` text NOT NULL,
	`storage_path` text NOT NULL,
	`metadata` text NOT NULL,
	`reference_count` integer DEFAULT 0 NOT NULL,
	`file_size` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_accessed_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`compression_ratio` real,
	`tags` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_library_content_hash_unique` ON `content_library` (`content_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_content_library_content_hash` ON `content_library` (`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_content_library_storage_path` ON `content_library` (`storage_path`);--> statement-breakpoint
CREATE INDEX `idx_content_library_reference_count` ON `content_library` (`reference_count`);--> statement-breakpoint
CREATE INDEX `idx_content_library_created_at` ON `content_library` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_content_library_last_accessed_at` ON `content_library` (`last_accessed_at`);--> statement-breakpoint
CREATE TABLE `content_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_content_id` integer NOT NULL,
	`target_content_id` integer NOT NULL,
	`relation_type` text NOT NULL,
	`similarity_score` real NOT NULL,
	`relation_strength` real DEFAULT 0,
	`relation_reason` text,
	`time_relation` text,
	`time_interval` text,
	`created_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	`updated_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	FOREIGN KEY (`source_content_id`) REFERENCES `enhanced_content_analysis`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_content_id`) REFERENCES `enhanced_content_analysis`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_content_relations_source` ON `content_relations` (`source_content_id`);--> statement-breakpoint
CREATE INDEX `idx_content_relations_target` ON `content_relations` (`target_content_id`);--> statement-breakpoint
CREATE INDEX `idx_content_relations_type` ON `content_relations` (`relation_type`);--> statement-breakpoint
CREATE INDEX `idx_content_relations_similarity` ON `content_relations` (`similarity_score`);--> statement-breakpoint
CREATE INDEX `idx_content_relations_created` ON `content_relations` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_content_relations_source_target_type` ON `content_relations` (`source_content_id`,`target_content_id`,`relation_type`);--> statement-breakpoint
CREATE TABLE `content_topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_analysis_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	`confidence` real NOT NULL,
	`relevance_score` real DEFAULT 0,
	`is_primary` integer DEFAULT false,
	FOREIGN KEY (`content_analysis_id`) REFERENCES `enhanced_content_analysis`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_content_topics_analysis` ON `content_topics` (`content_analysis_id`);--> statement-breakpoint
CREATE INDEX `idx_content_topics_topic` ON `content_topics` (`topic_id`);--> statement-breakpoint
CREATE INDEX `idx_content_topics_confidence` ON `content_topics` (`confidence`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_content_topics_analysis_topic` ON `content_topics` (`content_analysis_id`,`topic_id`);--> statement-breakpoint
CREATE TABLE `content_url_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`entry_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`source_id` integer,
	`title` text,
	`published_at` integer,
	`content_hash` text,
	`last_accessed_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`metadata` text,
	FOREIGN KEY (`entry_id`) REFERENCES `rss_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unq_content_url_index_url` ON `content_url_index` (`url`);--> statement-breakpoint
CREATE INDEX `idx_content_url_index_entry_id` ON `content_url_index` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_content_url_index_user_id` ON `content_url_index` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_content_url_index_source_id` ON `content_url_index` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_content_url_index_created_at` ON `content_url_index` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_content_url_index_last_accessed_at` ON `content_url_index` (`last_accessed_at`);--> statement-breakpoint
CREATE TABLE `enhanced_content_analysis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`content_id` integer NOT NULL,
	`source_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`summary` text,
	`topics` text,
	`keywords` text,
	`categories` text,
	`tags` text,
	`sentiment_score` real DEFAULT 0,
	`sentiment_label` text,
	`importance_score` real DEFAULT 0,
	`readability_score` real DEFAULT 0,
	`content_vector` text,
	`embedding_model` text DEFAULT 'text-embedding-ada-002',
	`temporal_context` text,
	`timeline_position` text DEFAULT 'established',
	`ai_model` text NOT NULL,
	`processing_time` integer DEFAULT 0,
	`processed_at` integer DEFAULT '"2025-10-17T13:32:14.494Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_id`) REFERENCES `processed_contents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_enhanced_content_user_id` ON `enhanced_content_analysis` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_enhanced_content_content_id` ON `enhanced_content_analysis` (`content_id`);--> statement-breakpoint
CREATE INDEX `idx_enhanced_content_sentiment` ON `enhanced_content_analysis` (`sentiment_score`);--> statement-breakpoint
CREATE INDEX `idx_enhanced_content_importance` ON `enhanced_content_analysis` (`importance_score`);--> statement-breakpoint
CREATE INDEX `idx_enhanced_content_processed_at` ON `enhanced_content_analysis` (`processed_at`);--> statement-breakpoint
CREATE TABLE `glm_call_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`config_id` integer NOT NULL,
	`request_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`model` text NOT NULL,
	`request_prompt` text NOT NULL,
	`request_parameters` text,
	`response_success` integer NOT NULL,
	`response_data` text,
	`response_error` text,
	`status_code` integer,
	`response_time` integer NOT NULL,
	`tokens_used` integer DEFAULT 0 NOT NULL,
	`prompt_tokens` integer DEFAULT 0,
	`completion_tokens` integer DEFAULT 0,
	`cost` real DEFAULT 0 NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`error_type` text,
	`error_details` text,
	`timestamp` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`config_id`) REFERENCES `glm_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_glm_call_logs_user_id` ON `glm_call_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_glm_call_logs_timestamp` ON `glm_call_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_glm_call_logs_request_id` ON `glm_call_logs` (`request_id`);--> statement-breakpoint
CREATE TABLE `glm_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`api_key` text NOT NULL,
	`base_url` text DEFAULT 'https://open.bigmodel.cn/api/paas/v4' NOT NULL,
	`model` text DEFAULT 'glm-4' NOT NULL,
	`max_tokens` integer DEFAULT 2000 NOT NULL,
	`temperature` real DEFAULT 0.7 NOT NULL,
	`timeout` integer DEFAULT 30000 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`max_concurrency` integer DEFAULT 1 NOT NULL,
	`daily_limit` integer,
	`monthly_limit` integer DEFAULT 3000,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_glm_configs_user_id` ON `glm_configs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_glm_configs_active` ON `glm_configs` (`is_active`);--> statement-breakpoint
CREATE TABLE `glm_monitoring` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`config_id` integer NOT NULL,
	`metric_type` text NOT NULL,
	`metric_value` real NOT NULL,
	`timestamp` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`additional_data` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`config_id`) REFERENCES `glm_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_glm_monitoring_user_metric` ON `glm_monitoring` (`user_id`,`metric_type`);--> statement-breakpoint
CREATE INDEX `idx_glm_monitoring_timestamp` ON `glm_monitoring` (`timestamp`);--> statement-breakpoint
CREATE TABLE `glm_request_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`config_id` integer NOT NULL,
	`content_id` text,
	`request_id` text NOT NULL,
	`prompt` text NOT NULL,
	`model` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`next_retry_at` integer,
	`error_message` text,
	`result_data` text,
	`estimated_tokens` integer,
	`actual_tokens` integer,
	`cost` real,
	`response_time` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`config_id`) REFERENCES `glm_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `glm_request_queue_request_id_unique` ON `glm_request_queue` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_glm_request_queue_user_id` ON `glm_request_queue` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_glm_request_queue_status` ON `glm_request_queue` (`status`);--> statement-breakpoint
CREATE INDEX `idx_glm_request_queue_priority` ON `glm_request_queue` (`priority`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_glm_request_queue_request_id` ON `glm_request_queue` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_glm_request_queue_next_retry` ON `glm_request_queue` (`next_retry_at`);--> statement-breakpoint
CREATE TABLE `glm_usage_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`config_id` integer NOT NULL,
	`date` text NOT NULL,
	`total_calls` integer DEFAULT 0 NOT NULL,
	`successful_calls` integer DEFAULT 0 NOT NULL,
	`failed_calls` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`average_response_time` real DEFAULT 0 NOT NULL,
	`model` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`config_id`) REFERENCES `glm_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_glm_usage_stats_user_date` ON `glm_usage_stats` (`user_id`,`config_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_glm_usage_stats_config_date` ON `glm_usage_stats` (`config_id`,`date`);--> statement-breakpoint
CREATE TABLE `keyword_entry_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`keyword_id` integer NOT NULL,
	`entry_id` integer NOT NULL,
	`processed_content_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`keyword_id`) REFERENCES `user_keywords`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `rss_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`processed_content_id`) REFERENCES `processed_contents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_keyword_entry_relations_user_id` ON `keyword_entry_relations` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_keyword_entry_relations_keyword_id` ON `keyword_entry_relations` (`keyword_id`);--> statement-breakpoint
CREATE INDEX `idx_keyword_entry_relations_entry_id` ON `keyword_entry_relations` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_keyword_entry_relations_processed_content_id` ON `keyword_entry_relations` (`processed_content_id`);--> statement-breakpoint
CREATE INDEX `idx_keyword_entry_relations_created_at` ON `keyword_entry_relations` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_keyword_entry_relations_keyword_entry` ON `keyword_entry_relations` (`keyword_id`,`entry_id`);--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`normalized_text` text NOT NULL,
	`is_entity` integer DEFAULT false,
	`entity_type` text,
	`frequency` integer DEFAULT 0,
	`created_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keywords_text_unique` ON `keywords` (`text`);--> statement-breakpoint
CREATE UNIQUE INDEX `keywords_normalized_text_unique` ON `keywords` (`normalized_text`);--> statement-breakpoint
CREATE INDEX `idx_keywords_text` ON `keywords` (`text`);--> statement-breakpoint
CREATE INDEX `idx_keywords_normalized` ON `keywords` (`normalized_text`);--> statement-breakpoint
CREATE INDEX `idx_keywords_entity` ON `keywords` (`is_entity`,`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_keywords_frequency` ON `keywords` (`frequency`);--> statement-breakpoint
CREATE TABLE `knowledge_graph_edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`source_node_id` integer NOT NULL,
	`target_node_id` integer NOT NULL,
	`edge_type` text NOT NULL,
	`weight` real DEFAULT 1,
	`properties` text,
	`created_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	`updated_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_node_id`) REFERENCES `knowledge_graph_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `knowledge_graph_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_edges_user` ON `knowledge_graph_edges` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_edges_source` ON `knowledge_graph_edges` (`source_node_id`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_edges_target` ON `knowledge_graph_edges` (`target_node_id`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_edges_type` ON `knowledge_graph_edges` (`edge_type`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_edges_weight` ON `knowledge_graph_edges` (`weight`);--> statement-breakpoint
CREATE TABLE `knowledge_graph_nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`node_type` text NOT NULL,
	`node_id` text NOT NULL,
	`label` text NOT NULL,
	`properties` text,
	`x_position` real,
	`y_position` real,
	`node_size` real DEFAULT 1,
	`node_color` text,
	`connection_count` integer DEFAULT 0,
	`importance_score` real DEFAULT 0,
	`created_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	`updated_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_nodes_user` ON `knowledge_graph_nodes` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_nodes_type` ON `knowledge_graph_nodes` (`node_type`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_nodes_importance` ON `knowledge_graph_nodes` (`importance_score`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_nodes_connections` ON `knowledge_graph_nodes` (`connection_count`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_knowledge_nodes_user_node_type` ON `knowledge_graph_nodes` (`user_id`,`node_type`,`node_id`);--> statement-breakpoint
CREATE TABLE `obsidian_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`template_content` text NOT NULL,
	`template_type` text DEFAULT 'article',
	`yaml_frontmatter_config` text,
	`link_strategies` text,
	`max_links` integer DEFAULT 10,
	`supported_styles` text,
	`is_default` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`version` text DEFAULT '1.0',
	`created_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	`updated_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	`created_by` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `obsidian_templates_name_unique` ON `obsidian_templates` (`name`);--> statement-breakpoint
CREATE INDEX `idx_obsidian_templates_name` ON `obsidian_templates` (`name`);--> statement-breakpoint
CREATE INDEX `idx_obsidian_templates_type` ON `obsidian_templates` (`template_type`);--> statement-breakpoint
CREATE INDEX `idx_obsidian_templates_active` ON `obsidian_templates` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_obsidian_templates_default` ON `obsidian_templates` (`is_default`);--> statement-breakpoint
CREATE TABLE `r2_access_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`access_id` integer NOT NULL,
	`operation` text NOT NULL,
	`resource_path` text NOT NULL,
	`resource_size` integer,
	`status_code` integer NOT NULL,
	`response_time` integer NOT NULL,
	`bytes_transferred` integer DEFAULT 0,
	`ip_address` text NOT NULL,
	`user_agent` text,
	`request_headers` text,
	`response_headers` text,
	`error_message` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`access_id`) REFERENCES `user_r2_access`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_r2_access_logs_user_id` ON `r2_access_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_r2_access_logs_access_id` ON `r2_access_logs` (`access_id`);--> statement-breakpoint
CREATE INDEX `idx_r2_access_logs_operation` ON `r2_access_logs` (`operation`);--> statement-breakpoint
CREATE INDEX `idx_r2_access_logs_timestamp` ON `r2_access_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_r2_access_logs_status_code` ON `r2_access_logs` (`status_code`);--> statement-breakpoint
CREATE TABLE `r2_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`access_id` integer NOT NULL,
	`session_id` text,
	`operation` text NOT NULL,
	`details` text,
	`risk_level` text DEFAULT 'low' NOT NULL,
	`is_suspicious` integer DEFAULT false NOT NULL,
	`flagged_for_review` integer DEFAULT false NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`access_id`) REFERENCES `user_r2_access`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_r2_audit_logs_user_id` ON `r2_audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_r2_audit_logs_operation` ON `r2_audit_logs` (`operation`);--> statement-breakpoint
CREATE INDEX `idx_r2_audit_logs_risk_level` ON `r2_audit_logs` (`risk_level`);--> statement-breakpoint
CREATE INDEX `idx_r2_audit_logs_timestamp` ON `r2_audit_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_r2_audit_logs_is_suspicious` ON `r2_audit_logs` (`is_suspicious`);--> statement-breakpoint
CREATE TABLE `r2_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`access_id` integer NOT NULL,
	`resource_pattern` text NOT NULL,
	`actions` text NOT NULL,
	`conditions` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`access_id`) REFERENCES `user_r2_access`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_r2_permissions_access_id` ON `r2_permissions` (`access_id`);--> statement-breakpoint
CREATE INDEX `idx_r2_permissions_resource_pattern` ON `r2_permissions` (`resource_pattern`);--> statement-breakpoint
CREATE INDEX `idx_r2_permissions_created_at` ON `r2_permissions` (`created_at`);--> statement-breakpoint
CREATE TABLE `smart_link_generation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`content_analysis_id` integer NOT NULL,
	`total_links_generated` integer DEFAULT 0,
	`tag_links_count` integer DEFAULT 0,
	`topic_links_count` integer DEFAULT 0,
	`similarity_links_count` integer DEFAULT 0,
	`temporal_links_count` integer DEFAULT 0,
	`generation_config` text,
	`generation_time` integer DEFAULT 0,
	`average_link_quality` real DEFAULT 0,
	`created_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_analysis_id`) REFERENCES `enhanced_content_analysis`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_smart_link_logs_user` ON `smart_link_generation_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_smart_link_logs_content` ON `smart_link_generation_logs` (`content_analysis_id`);--> statement-breakpoint
CREATE INDEX `idx_smart_link_logs_created` ON `smart_link_generation_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `storage_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`total_shared_files` integer DEFAULT 0 NOT NULL,
	`total_user_files` integer DEFAULT 0 NOT NULL,
	`total_storage_used` integer DEFAULT 0 NOT NULL,
	`shared_content_savings` integer DEFAULT 0 NOT NULL,
	`compression_ratio` real DEFAULT 0 NOT NULL,
	`orphaned_files_cleaned` integer DEFAULT 0 NOT NULL,
	`space_freed` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unq_storage_stats_date` ON `storage_stats` (`date`);--> statement-breakpoint
CREATE INDEX `idx_storage_stats_created_at` ON `storage_stats` (`created_at`);--> statement-breakpoint
CREATE TABLE `topic_entry_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	`entry_id` integer NOT NULL,
	`processed_content_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `user_topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `rss_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`processed_content_id`) REFERENCES `processed_contents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_topic_entry_relations_user_id` ON `topic_entry_relations` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_topic_entry_relations_topic_id` ON `topic_entry_relations` (`topic_id`);--> statement-breakpoint
CREATE INDEX `idx_topic_entry_relations_entry_id` ON `topic_entry_relations` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_topic_entry_relations_processed_content_id` ON `topic_entry_relations` (`processed_content_id`);--> statement-breakpoint
CREATE INDEX `idx_topic_entry_relations_created_at` ON `topic_entry_relations` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_topic_entry_relations_topic_entry` ON `topic_entry_relations` (`topic_id`,`entry_id`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'general',
	`parent_topic_id` integer,
	`is_trending` integer DEFAULT false,
	`trend_score` real DEFAULT 0,
	`created_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	`updated_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	FOREIGN KEY (`parent_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_name_unique` ON `topics` (`name`);--> statement-breakpoint
CREATE INDEX `idx_topics_name` ON `topics` (`name`);--> statement-breakpoint
CREATE INDEX `idx_topics_category` ON `topics` (`category`);--> statement-breakpoint
CREATE INDEX `idx_topics_trending` ON `topics` (`is_trending`,`trend_score`);--> statement-breakpoint
CREATE INDEX `idx_topics_parent` ON `topics` (`parent_topic_id`);--> statement-breakpoint
CREATE TABLE `user_auto_storage_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`storage_path` text DEFAULT 'notes' NOT NULL,
	`filename_pattern` text DEFAULT '{title}_{id}_{date}' NOT NULL,
	`max_file_size` integer DEFAULT 1048576 NOT NULL,
	`max_files_per_day` integer DEFAULT 100 NOT NULL,
	`include_metadata` integer DEFAULT true NOT NULL,
	`file_format` text DEFAULT 'standard' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_auto_storage_configs_user_id_unique` ON `user_auto_storage_configs` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_auto_storage_configs_user_id` ON `user_auto_storage_configs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_auto_storage_configs_enabled` ON `user_auto_storage_configs` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_user_auto_storage_configs_file_format` ON `user_auto_storage_configs` (`file_format`);--> statement-breakpoint
CREATE INDEX `idx_user_auto_storage_configs_created_at` ON `user_auto_storage_configs` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_directory_quotas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`max_storage_bytes` integer DEFAULT 104857600 NOT NULL,
	`max_file_count` integer DEFAULT 1000 NOT NULL,
	`current_storage_bytes` integer DEFAULT 0 NOT NULL,
	`current_file_count` integer DEFAULT 0 NOT NULL,
	`last_updated` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_directory_quotas_user_id_unique` ON `user_directory_quotas` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_directory_quotas_user_id` ON `user_directory_quotas` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_directory_quotas_storage_bytes` ON `user_directory_quotas` (`current_storage_bytes`);--> statement-breakpoint
CREATE INDEX `idx_user_directory_quotas_file_count` ON `user_directory_quotas` (`current_file_count`);--> statement-breakpoint
CREATE INDEX `idx_user_directory_quotas_last_updated` ON `user_directory_quotas` (`last_updated`);--> statement-breakpoint
CREATE TABLE `user_keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`keyword_name` text NOT NULL,
	`entry_count` integer DEFAULT 1 NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_keywords_user_id` ON `user_keywords` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_keywords_keyword_name` ON `user_keywords` (`keyword_name`);--> statement-breakpoint
CREATE INDEX `idx_user_keywords_entry_count` ON `user_keywords` (`entry_count`);--> statement-breakpoint
CREATE INDEX `idx_user_keywords_last_used_at` ON `user_keywords` (`last_used_at`);--> statement-breakpoint
CREATE INDEX `idx_user_keywords_created_at` ON `user_keywords` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_keywords_user_keyword` ON `user_keywords` (`user_id`,`keyword_name`);--> statement-breakpoint
CREATE TABLE `user_r2_access` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`access_key_id` text NOT NULL,
	`secret_access_key_hash` text NOT NULL,
	`path_prefix` text NOT NULL,
	`bucket_name` text NOT NULL,
	`region` text DEFAULT 'auto' NOT NULL,
	`endpoint` text NOT NULL,
	`permissions_json` text DEFAULT '{"read": true, "write": false, "delete": false, "list": true}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`max_storage_bytes` integer DEFAULT 104857600 NOT NULL,
	`current_storage_bytes` integer DEFAULT 0 NOT NULL,
	`max_file_count` integer DEFAULT 1000 NOT NULL,
	`current_file_count` integer DEFAULT 0 NOT NULL,
	`is_readonly` integer DEFAULT true NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_r2_access_access_key_id_unique` ON `user_r2_access` (`access_key_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_r2_access_user_id` ON `user_r2_access` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_r2_access_access_key_id` ON `user_r2_access` (`access_key_id`);--> statement-breakpoint
CREATE INDEX `idx_user_r2_access_is_active` ON `user_r2_access` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_user_r2_access_path_prefix` ON `user_r2_access` (`path_prefix`);--> statement-breakpoint
CREATE INDEX `idx_user_r2_access_created_at` ON `user_r2_access` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_user_r2_access_expires_at` ON `user_r2_access` (`expires_at`);--> statement-breakpoint
CREATE TABLE `user_storage_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`entry_id` integer NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`processing_time` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `rss_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_storage_logs_user_id` ON `user_storage_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_logs_source_id` ON `user_storage_logs` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_logs_entry_id` ON `user_storage_logs` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_logs_status` ON `user_storage_logs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_logs_created_at` ON `user_storage_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_storage_refs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`entry_id` integer NOT NULL,
	`content_hash` text NOT NULL,
	`user_path` text NOT NULL,
	`is_modified` integer DEFAULT false NOT NULL,
	`current_hash` text,
	`modified_at` integer,
	`file_size` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_accessed_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`access_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `rss_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_storage_refs_user_entry` ON `user_storage_refs` (`user_id`,`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_refs_user_id` ON `user_storage_refs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_refs_entry_id` ON `user_storage_refs` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_refs_content_hash` ON `user_storage_refs` (`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_refs_is_modified` ON `user_storage_refs` (`is_modified`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_refs_created_at` ON `user_storage_refs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_refs_last_accessed_at` ON `user_storage_refs` (`last_accessed_at`);--> statement-breakpoint
CREATE TABLE `user_storage_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`total_files` integer DEFAULT 0 NOT NULL,
	`total_size` integer DEFAULT 0 NOT NULL,
	`today_files` integer DEFAULT 0 NOT NULL,
	`today_size` integer DEFAULT 0 NOT NULL,
	`last_storage_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_storage_stats_user_id_unique` ON `user_storage_stats` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_storage_stats_user_id` ON `user_storage_stats` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_stats_created_at` ON `user_storage_stats` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_user_storage_stats_updated_at` ON `user_storage_stats` (`updated_at`);--> statement-breakpoint
CREATE TABLE `user_template_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`template_id` integer NOT NULL,
	`preference_order` integer DEFAULT 0,
	`custom_config` text,
	`usage_count` integer DEFAULT 0,
	`last_used_at` integer,
	`created_at` integer DEFAULT '"2025-10-17T13:32:14.495Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `obsidian_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_template_prefs_user` ON `user_template_preferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_template_prefs_template` ON `user_template_preferences` (`template_id`);--> statement-breakpoint
CREATE INDEX `idx_user_template_prefs_order` ON `user_template_preferences` (`preference_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_template_prefs_user_template` ON `user_template_preferences` (`user_id`,`template_id`);--> statement-breakpoint
CREATE TABLE `user_topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`topic_name` text NOT NULL,
	`entry_count` integer DEFAULT 1 NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_topics_user_id` ON `user_topics` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_topics_topic_name` ON `user_topics` (`topic_name`);--> statement-breakpoint
CREATE INDEX `idx_user_topics_entry_count` ON `user_topics` (`entry_count`);--> statement-breakpoint
CREATE INDEX `idx_user_topics_last_used_at` ON `user_topics` (`last_used_at`);--> statement-breakpoint
CREATE INDEX `idx_user_topics_created_at` ON `user_topics` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_user_topics_user_topic` ON `user_topics` (`user_id`,`topic_name`);
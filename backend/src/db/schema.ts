// src/db/schema.ts
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// 用户表
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  
  // 用户状态管理字段
  status: text('status').notNull().$type<'active' | 'inactive' | 'suspended' | 'pending'>().default('active'),
  role: text('role').notNull().$type<'user' | 'admin' | 'super_admin'>().default('user'),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
  
  // 用户统计信息
  loginCount: integer('login_count').default(0).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  lastLoginIp: text('last_login_ip'),
  registeredIp: text('registered_ip'),
  
  // 风险评估字段
  riskLevel: text('risk_level').notNull().$type<'low' | 'medium' | 'high'>().default('low'),
  riskScore: integer('risk_score').default(0).notNull(),
  
  // 管理备注
  notes: text('notes'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  emailIdx: index('idx_users_email').on(table.email),
  statusIdx: index('idx_users_status').on(table.status),
  roleIdx: index('idx_users_role').on(table.role),
  createdAtIdx: index('idx_users_created_at').on(table.createdAt),
  riskLevelIdx: index('idx_users_risk_level').on(table.riskLevel),
}));

// RSS源表
export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  url: text('url').notNull(),
  name: text('name').notNull(),
  description: text('description'), // RSS源描述
  isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(), // 是否为公共源
  originalSourceId: integer('original_source_id'), // 复制自哪个源（自引用）
  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }), // 上次获取时间
  fetchFailureCount: integer('fetch_failure_count').default(0).notNull(), // 连续失败次数
  fetchErrorMessage: text('fetch_error_message'), // 最近的错误信息
  
  // 推荐源相关字段
  isRecommended: integer('is_recommended', { mode: 'boolean' }).default(false).notNull(), // 是否为推荐源
  recommendationLevel: text('recommendation_level').$type<'basic' | 'premium' | 'featured'>().default('basic').notNull(), // 推荐级别
  
  // 质量评估字段
  qualityAvailability: integer('quality_availability').default(0).notNull(), // 可用性评分 (0-100)
  qualityContentQuality: integer('quality_content_quality').default(0).notNull(), // 内容质量评分 (0-100)
  qualityUpdateFrequency: integer('quality_update_frequency').default(0).notNull(), // 更新频率评分 (0-100)
  qualityLastValidatedAt: integer('quality_last_validated_at', { mode: 'timestamp' }), // 上次验证时间
  qualityValidationStatus: text('quality_validation_status').$type<'pending' | 'approved' | 'rejected'>().default('pending').notNull(), // 验证状态
  qualityValidationNotes: text('quality_validation_notes'), // 验证备注
  
  // 统计数据字段
  statisticsTotalSubscribers: integer('statistics_total_subscribers').default(0).notNull(), // 总订阅数
  statisticsActiveSubscribers: integer('statistics_active_subscribers').default(0).notNull(), // 活跃订阅数
  statisticsAverageUsage: integer('statistics_average_usage').default(0).notNull(), // 平均使用量
  statisticsSatisfaction: integer('statistics_satisfaction').default(0).notNull(), // 满意度评分 (0-5)
  
  // 推荐源元数据
  recommendedBy: integer('recommended_by').references(() => users.id), // 推荐人
  recommendedAt: integer('recommended_at', { mode: 'timestamp' }), // 推荐时间
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: index('idx_sources_user_id').on(table.userId),
  urlIdx: index('idx_sources_url').on(table.url),
  isPublicIdx: index('idx_sources_is_public').on(table.isPublic),
  isRecommendedIdx: index('idx_sources_is_recommended').on(table.isRecommended),
  recommendationLevelIdx: index('idx_sources_recommendation_level').on(table.recommendationLevel),
  qualityValidationStatusIdx: index('idx_sources_quality_validation_status').on(table.qualityValidationStatus),
  createdAtIdx: index('idx_sources_created_at').on(table.createdAt),
}));

// RSS条目表 - 存储原始RSS条目信息
export const rssEntries = sqliteTable('rss_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => sources.id),
  guid: text('guid').notNull(), // RSS条目唯一标识
  title: text('title').notNull(),
  link: text('link').notNull(),
  content: text('content'), // 原始内容
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(), // 发布时间
  processed: integer('processed', { mode: 'boolean' }).default(false).notNull(), // 是否已处理
  processedAt: integer('processed_at', { mode: 'timestamp' }), // 处理时间
  failureCount: integer('failure_count').default(0).notNull(), // 处理失败次数
  errorMessage: text('error_message'), // 错误信息
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  sourceIdIdx: index('idx_rss_entries_source_id').on(table.sourceId),
  guidIdx: index('idx_rss_entries_guid').on(table.guid),
  processedIdx: index('idx_rss_entries_processed').on(table.processed),
  publishedAtIdx: index('idx_rss_entries_published_at').on(table.publishedAt),
  createdAtIdx: index('idx_rss_entries_created_at').on(table.createdAt),
  uniqueGuidIdx: uniqueIndex('unq_rss_entries_guid').on(table.guid),
}));

// 处理后的内容表 - 存储已处理的内容
export const processedContents = sqliteTable('processed_contents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entryId: integer('entry_id').notNull().references(() => rssEntries.id),
  summary: text('summary').notNull(), // AI生成的摘要
  markdownContent: text('markdown_content').notNull(), // AI处理后的Markdown内容
  keywords: text('keywords'), // 关键词（逗号分隔）
  sentiment: text('sentiment'), // 情感分析结果
  processingTime: integer('processing_time'), // 处理耗时（毫秒）
  modelUsed: text('model_used'), // 使用的AI模型
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  entryIdIdx: index('idx_processed_contents_entry_id').on(table.entryId),
  createdAtIdx: index('idx_processed_contents_created_at').on(table.createdAt),
  keywordsIdx: index('idx_processed_contents_keywords').on(table.keywords),
}));

// 用户笔记表 - 存储用户个性化内容
export const userNotes = sqliteTable('user_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  entryId: integer('entry_id').notNull().references(() => rssEntries.id),
  processedContentId: integer('processed_content_id').notNull().references(() => processedContents.id),
  title: text('title').notNull(), // 个性化标题
  content: text('content').notNull(), // 个性化内容
  personalTags: text('personal_tags'), // 用户个性化标签
  isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false).notNull(), // 是否收藏
  readStatus: integer('read_status').default(0).notNull(), // 阅读状态（0未读，1已读）
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: index('idx_user_notes_user_id').on(table.userId),
  entryIdIdx: index('idx_user_notes_entry_id').on(table.entryId),
  processedContentIdIdx: index('idx_user_notes_processed_content_id').on(table.processedContentId),
  isFavoriteIdx: index('idx_user_notes_is_favorite').on(table.isFavorite),
  readStatusIdx: index('idx_user_notes_read_status').on(table.readStatus),
  createdAtIdx: index('idx_user_notes_created_at').on(table.createdAt),
}));

// 同步凭证表 - 存储用户的R2访问凭证
export const syncCredentials = sqliteTable('sync_credentials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(), // 凭证名称，便于用户识别
  accessKeyId: text('access_key_id').notNull(), // R2访问密钥ID
  secretAccessKey: text('secret_access_key').notNull(), // R2秘密访问密钥（加密存储）
  region: text('region').notNull(), // R2区域，如 'auto' 或 'us-east-1'
  endpoint: text('endpoint').notNull(), // R2端点URL
  bucket: text('bucket').notNull(), // R2桶名称
  prefix: text('prefix').notNull(), // 用户专属前缀，确保数据隔离
  permissions: text('permissions').notNull().default('readonly'), // 权限类型，默认为只读
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(), // 凭证是否激活
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }), // 上次使用时间
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // 凭证过期时间
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: index('idx_sync_credentials_user_id').on(table.userId),
  isActiveIdx: index('idx_sync_credentials_is_active').on(table.isActive),
  expiresAtIdx: index('idx_sync_credentials_expires_at').on(table.expiresAt),
  createdAtIdx: index('idx_sync_credentials_created_at').on(table.createdAt),
}));

// 凭证使用日志表 - 记录凭证的所有操作，用于安全审计
export const credentialLogs = sqliteTable('credential_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  credentialId: integer('credential_id').notNull().references(() => syncCredentials.id),
  userId: integer('user_id').notNull().references(() => users.id),
  action: text('action').notNull().default('created'), // 操作类型：'created', 'accessed', 'revoked', 'regenerated', 'deleted'
  ipAddress: text('ip_address').notNull(), // 操作时的IP地址
  userAgent: text('user_agent'), // 操作时的User-Agent
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  details: text('details'), // 操作详情，JSON格式存储额外信息
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  credentialIdIdx: index('idx_credential_logs_credential_id').on(table.credentialId),
  userIdIdx: index('idx_credential_logs_user_id').on(table.userId),
  actionIdx: index('idx_credential_logs_action').on(table.action),
  timestampIdx: index('idx_credential_logs_timestamp').on(table.timestamp),
  createdAtIdx: index('idx_credential_logs_created_at').on(table.createdAt),
}));

// 队列处理状态跟踪表
export const processingStatuses = sqliteTable('processing_statuses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: text('message_id').notNull().unique(),
  status: text('status').notNull().$type<'pending' | 'processing' | 'completed' | 'failed'>(),
  userId: integer('user_id').notNull().references(() => users.id),
  sourceId: integer('source_id').notNull().references(() => sources.id),
  error: text('error_message'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  retryCount: integer('retry_count').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  messageIdIdx: uniqueIndex('unq_processing_statuses_message_id').on(table.messageId),
  statusIdx: index('idx_processing_statuses_status').on(table.status),
  userIdIdx: index('idx_processing_statuses_user_id').on(table.userId),
  sourceIdIdx: index('idx_processing_statuses_source_id').on(table.sourceId),
  createdAtIdx: index('idx_processing_statuses_created_at').on(table.createdAt),
}));

// 队列消息历史记录表
export const messageHistories = sqliteTable('message_histories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: text('message_id').notNull(),
  status: text('status').notNull().$type<'queued' | 'processing' | 'completed' | 'failed' | 'retried' | 'dead_letter'>(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  error: text('error_message'),
  retryCount: integer('retry_count').default(0).notNull(),
  processingTime: integer('processing_time'), // 处理时间（毫秒）
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  messageIdIdx: index('idx_message_histories_message_id').on(table.messageId),
  statusIdx: index('idx_message_histories_status').on(table.status),
  timestampIdx: index('idx_message_histories_timestamp').on(table.timestamp),
  createdAtIdx: index('idx_message_histories_created_at').on(table.createdAt),
}));

// 队列统计信息表
export const queueStats = sqliteTable('queue_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  queueName: text('queue_name').notNull(),
  pendingMessages: integer('pending_messages').default(0).notNull(),
  processingMessages: integer('processing_messages').default(0).notNull(),
  failedMessages: integer('failed_messages').default(0).notNull(),
  deadLetterMessages: integer('dead_letter_messages').default(0).notNull(),
  averageProcessingTime: integer('average_processing_time').default(0).notNull(),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  queueNameIdx: uniqueIndex('unq_queue_stats_queue_name').on(table.queueName),
  lastUpdatedIdx: index('idx_queue_stats_last_updated').on(table.lastUpdated),
  createdAtIdx: index('idx_queue_stats_created_at').on(table.createdAt),
}));

// 推荐源分类表
export const sourceCategories = sqliteTable('source_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  nameIdx: uniqueIndex('unq_source_categories_name').on(table.name),
  isActiveIdx: index('idx_source_categories_is_active').on(table.isActive),
  sortOrderIdx: index('idx_source_categories_sort_order').on(table.sortOrder),
  createdAtIdx: index('idx_source_categories_created_at').on(table.createdAt),
}));

// 推荐源标签表
export const sourceTags = sqliteTable('source_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  color: text('color'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  nameIdx: uniqueIndex('unq_source_tags_name').on(table.name),
  isActiveIdx: index('idx_source_tags_is_active').on(table.isActive),
  usageCountIdx: index('idx_source_tags_usage_count').on(table.usageCount),
  createdAtIdx: index('idx_source_tags_created_at').on(table.createdAt),
}));

// 推荐源与分类的关联表
export const sourceCategoryRelations = sqliteTable('source_category_relations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => sourceCategories.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  sourceIdIdx: index('idx_source_category_relations_source_id').on(table.sourceId),
  categoryIdIdx: index('idx_source_category_relations_category_id').on(table.categoryId),
  createdAtIdx: index('idx_source_category_relations_created_at').on(table.createdAt),
  uniqueSourceCategoryIdx: uniqueIndex('unq_source_category_relations_source_category').on(table.sourceId, table.categoryId),
}));

// 推荐源与标签的关联表
export const sourceTagRelations = sqliteTable('source_tag_relations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => sourceTags.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  sourceIdIdx: index('idx_source_tag_relations_source_id').on(table.sourceId),
  tagIdIdx: index('idx_source_tag_relations_tag_id').on(table.tagId),
  createdAtIdx: index('idx_source_tag_relations_created_at').on(table.createdAt),
  uniqueSourceTagIdx: uniqueIndex('unq_source_tag_relations_source_tag').on(table.sourceId, table.tagId),
}));

// 推荐源验证历史表
export const sourceValidationHistories = sqliteTable('source_validation_histories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  validationType: text('validation_type').notNull().$type<'automatic' | 'manual'>(),
  availabilityScore: integer('availability_score'),
  contentQualityScore: integer('content_quality_score'),
  updateFrequencyScore: integer('update_frequency_score'),
  overallScore: integer('overall_score'),
  status: text('status').notNull().$type<'passed' | 'failed' | 'warning'>(),
  errorMessage: text('error_message'),
  validationDetails: text('validation_details'),
  validatedBy: integer('validated_by').references(() => users.id),
  validatedAt: integer('validated_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  sourceIdIdx: index('idx_source_validation_histories_source_id').on(table.sourceId),
  validationTypeIdx: index('idx_source_validation_histories_validation_type').on(table.validationType),
  statusIdx: index('idx_source_validation_histories_status').on(table.status),
  validatedAtIdx: index('idx_source_validation_histories_validated_at').on(table.validatedAt),
  createdAtIdx: index('idx_source_validation_histories_created_at').on(table.createdAt),
}));
// 处理任务状态表
export const processingTasks = sqliteTable('processing_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceId: integer('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  type: text('task_type').notNull().$type<'rss_fetch' | 'ai_process' | 'content_storage' | 'error_retry'>(),
  status: text('status').notNull().$type<'pending' | 'processing' | 'completed' | 'failed' | 'retrying'>(),
  progress: integer('progress').notNull().default(0), // 0-100
  title: text('title').notNull(),
  description: text('description'),
  errorMessage: text('error_message'),
  resultData: text('result_data'), // JSON存储
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  estimatedDuration: integer('estimated_duration'), // 秒
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: index('idx_processing_tasks_user_id').on(table.userId),
  sourceIdIdx: index('idx_processing_tasks_source_id').on(table.sourceId),
  statusIdx: index('idx_processing_tasks_status').on(table.status),
  typeIdx: index('idx_processing_tasks_type').on(table.type),
  createdAtIdx: index('idx_processing_tasks_created_at').on(table.createdAt),
  startedAtIdx: index('idx_processing_tasks_started_at').on(table.startedAt),
}));

// 状态历史记录表
export const statusHistories = sqliteTable('status_histories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => processingTasks.id, { onDelete: 'cascade' }),
  previousStatus: text('previous_status').notNull(),
  newStatus: text('new_status').notNull(),
  progress: integer('progress').notNull(),
  message: text('message'),
  metadata: text('metadata'), // JSON存储
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  taskIdIdx: index('idx_status_histories_task_id').on(table.taskId),
  timestampIdx: index('idx_status_histories_timestamp').on(table.timestamp),
}));

// 用户统计摘要表
export const userStatistics = sqliteTable('user_statistics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  totalTasks: integer('total_tasks').notNull().default(0),
  completedTasks: integer('completed_tasks').notNull().default(0),
  failedTasks: integer('failed_tasks').notNull().default(0),
  processingTasks: integer('processing_tasks').notNull().default(0),
  averageProcessingTime: integer('average_processing_time').default(0), // 秒
  tasksToday: integer('tasks_today').notNull().default(0),
  tasksThisWeek: integer('tasks_this_week').notNull().default(0),
  tasksThisMonth: integer('tasks_this_month').notNull().default(0),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: uniqueIndex('unq_user_statistics_user_id').on(table.userId),
  lastUpdatedIdx: index('idx_user_statistics_last_updated').on(table.lastUpdated),
  createdAtIdx: index('idx_user_statistics_created_at').on(table.createdAt),
}));

// 通知设置表
export const notificationSettings = sqliteTable('notification_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  enableRealtimeNotifications: integer('enable_realtime_notifications', { mode: 'boolean' }).notNull().default(true),
  enableEmailNotifications: integer('enable_email_notifications', { mode: 'boolean' }).notNull().default(false),
  notifyOnCompleted: integer('notify_on_completed', { mode: 'boolean' }).notNull().default(true),
  notifyOnFailed: integer('notify_on_failed', { mode: 'boolean' }).notNull().default(true),
  notifyOnError: integer('notify_on_error', { mode: 'boolean' }).notNull().default(true),
  emailFrequency: text('email_frequency').notNull().default('immediate').$type<'immediate' | 'daily' | 'weekly'>(),
  quietHoursEnabled: integer('quiet_hours_enabled', { mode: 'boolean' }).notNull().default(false),
  quietHoursStart: text('quiet_hours_start'), // HH:mm
  quietHoursEnd: text('quiet_hours_end'), // HH:mm
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: uniqueIndex('unq_notification_settings_user_id').on(table.userId),
  enableRealtimeNotificationsIdx: index('idx_notification_settings_enable_realtime').on(table.enableRealtimeNotifications),
  enableEmailNotificationsIdx: index('idx_notification_settings_enable_email').on(table.enableEmailNotifications),
  createdAtIdx: index('idx_notification_settings_created_at').on(table.createdAt),
}));

// 通知记录表
export const notificationRecords = sqliteTable('notification_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull().$type<'task_completed' | 'task_failed' | 'task_progress' | 'error' | 'system'>(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: text('data'), // JSON存储
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  sentVia: text('sent_via').notNull().default('realtime').$type<'realtime' | 'email'>(),
  scheduledFor: integer('scheduled_for', { mode: 'timestamp' }),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: index('idx_notification_records_user_id').on(table.userId),
  typeIdx: index('idx_notification_records_type').on(table.type),
  isReadIdx: index('idx_notification_records_is_read').on(table.isRead),
  sentViaIdx: index('idx_notification_records_sent_via').on(table.sentVia),
  createdAtIdx: index('idx_notification_records_created_at').on(table.createdAt),
  scheduledForIdx: index('idx_notification_records_scheduled_for').on(table.scheduledFor),
}));


// 用户角色表
export const userRoles = sqliteTable('user_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  permissions: text('permissions').notNull(), // JSON格式存储权限列表
  isSystemRole: integer('is_system_role', { mode: 'boolean' }).default(false).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  nameIdx: uniqueIndex('unq_user_roles_name').on(table.name),
  isActiveIdx: index('idx_user_roles_is_active').on(table.isActive),
  sortOrderIdx: index('idx_user_roles_sort_order').on(table.sortOrder),
  createdAtIdx: index('idx_user_roles_created_at').on(table.createdAt),
}));

// 用户权限表
export const userPermissions = sqliteTable('user_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  resource: text('resource').notNull(), // 资源类型，如 'users', 'sources', 'admin'
  action: text('action').notNull(), // 操作类型，如 'read', 'write', 'delete', 'admin'
  conditions: text('conditions'), // JSON格式存储条件
  isSystemPermission: integer('is_system_permission', { mode: 'boolean' }).default(false).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  nameIdx: uniqueIndex('unq_user_permissions_name').on(table.name),
  resourceActionIdx: index('idx_user_permissions_resource_action').on(table.resource, table.action),
  isActiveIdx: index('idx_user_permissions_is_active').on(table.isActive),
  createdAtIdx: index('idx_user_permissions_created_at').on(table.createdAt),
}));

// 用户角色关联表
export const userRoleRelations = sqliteTable('user_role_relations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => userRoles.id, { onDelete: 'cascade' }),
  assignedBy: integer('assigned_by').references(() => users.id), // 分配者
  assignedAt: integer('assigned_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // 角色过期时间
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: index('idx_user_role_relations_user_id').on(table.userId),
  roleIdIdx: index('idx_user_role_relations_role_id').on(table.roleId),
  isActiveIdx: index('idx_user_role_relations_is_active').on(table.isActive),
  assignedAtIdx: index('idx_user_role_relations_assigned_at').on(table.assignedAt),
  expiresAtIdx: index('idx_user_role_relations_expires_at').on(table.expiresAt),
  createdAtIdx: index('idx_user_role_relations_created_at').on(table.createdAt),
  uniqueUserRoleIdx: uniqueIndex('unq_user_role_relations_user_role').on(table.userId, table.roleId),
}));

// 用户操作日志表
export const userOperationLogs = sqliteTable('user_operation_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  adminId: integer('admin_id').notNull().references(() => users.id, { onDelete: 'cascade' }), // 执行操作的管理员
  operation: text('operation').notNull().$type<'create' | 'update' | 'delete' | 'status_change' | 'role_change' | 'login' | 'logout'>(),
  details: text('details'), // JSON格式存储操作详情
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  result: text('result').notNull().$type<'success' | 'failure'>().default('success'),
  errorMessage: text('error_message'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: index('idx_user_operation_logs_user_id').on(table.userId),
  adminIdIdx: index('idx_user_operation_logs_admin_id').on(table.adminId),
  operationIdx: index('idx_user_operation_logs_operation').on(table.operation),
  resultIdx: index('idx_user_operation_logs_result').on(table.result),
  timestampIdx: index('idx_user_operation_logs_timestamp').on(table.timestamp),
}));

// 用户会话表
export const userSessions = sqliteTable('user_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().unique(),
  token: text('token').notNull(),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: index('idx_user_sessions_user_id').on(table.userId),
  sessionIdIdx: uniqueIndex('unq_user_sessions_session_id').on(table.sessionId),
  isActiveIdx: index('idx_user_sessions_is_active').on(table.isActive),
  expiresAtIdx: index('idx_user_sessions_expires_at').on(table.expiresAt),
  lastActivityAtIdx: index('idx_user_sessions_last_activity_at').on(table.lastActivityAt),
  createdAtIdx: index('idx_user_sessions_created_at').on(table.createdAt),
}));

// 用户设置表
export const userSettings = sqliteTable('user_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  language: text('language').default('zh-CN').notNull(),
  timezone: text('timezone').default('Asia/Shanghai').notNull(),
  theme: text('theme').default('light').notNull(),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).default(true).notNull(),
  emailNotifications: integer('email_notifications', { mode: 'boolean' }).default(true).notNull(),
  dailyDigest: integer('daily_digest', { mode: 'boolean' }).default(false).notNull(),
  settings: text('settings'), // JSON格式存储其他设置
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  // 索引定义
  userIdIdx: uniqueIndex('unq_user_settings_user_id').on(table.userId),
  languageIdx: index('idx_user_settings_language').on(table.language),
  timezoneIdx: index('idx_user_settings_timezone').on(table.timezone),
  themeIdx: index('idx_user_settings_theme').on(table.theme),
  createdAtIdx: index('idx_user_settings_created_at').on(table.createdAt),
}));


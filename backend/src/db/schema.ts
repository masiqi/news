// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 用户表
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

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
});

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
});

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
});

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
  permissions: text('permissions', { default: 'readonly' }).notNull(), // 权限类型，默认为只读
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(), // 凭证是否激活
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }), // 上次使用时间
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // 凭证过期时间
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 凭证使用日志表 - 记录凭证的所有操作，用于安全审计
export const credentialLogs = sqliteTable('credential_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  credentialId: integer('credential_id').notNull().references(() => syncCredentials.id),
  userId: integer('user_id').notNull().references(() => users.id),
  action: text('action', { default: 'created' }).notNull(), // 操作类型：'created', 'accessed', 'revoked', 'regenerated', 'deleted'
  ipAddress: text('ip_address').notNull(), // 操作时的IP地址
  userAgent: text('user_agent'), // 操作时的User-Agent
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  details: text('details'), // 操作详情，JSON格式存储额外信息
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

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
});

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
});

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
});